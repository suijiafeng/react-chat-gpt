// 限流中间件单元测试：窗口计数、429 响应、不同 key 互不影响、窗口重置。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/middleware/rateLimit.js';

const mkRes = () => {
  const res = {
    headers: {},
    statusCode: 200,
    body: null,
    set(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  return res;
};

const hit = (limiter, key) => {
  const res = mkRes();
  let passed = false;
  limiter({ ip: key, session: { userId: key } }, res, () => { passed = true; });
  return { passed, res };
};

test('窗口内不超限放行，超限返回 429 且带 Retry-After', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 3, keyFn: (req) => req.session.userId });
  for (let i = 0; i < 3; i++) {
    assert.equal(hit(limiter, 'u1').passed, true, `第 ${i + 1} 次应放行`);
  }
  const { passed, res } = hit(limiter, 'u1');
  assert.equal(passed, false);
  assert.equal(res.statusCode, 429);
  assert.ok(res.headers['Retry-After']);
  assert.match(res.body.message, /频繁/);
});

test('不同用户各自独立计数', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 1, keyFn: (req) => req.session.userId });
  assert.equal(hit(limiter, 'a').passed, true);
  assert.equal(hit(limiter, 'a').passed, false);
  assert.equal(hit(limiter, 'b').passed, true, '另一个用户不受影响');
});

test('窗口过期后计数重置', async () => {
  const limiter = createRateLimiter({ windowMs: 30, max: 1, keyFn: (req) => req.session.userId });
  assert.equal(hit(limiter, 'u').passed, true);
  assert.equal(hit(limiter, 'u').passed, false);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(hit(limiter, 'u').passed, true, '新窗口应重新放行');
});

test('响应头暴露配额余量', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 5, keyFn: (req) => req.session.userId });
  const { res } = hit(limiter, 'q');
  assert.equal(res.headers['X-RateLimit-Limit'], '5');
  assert.equal(res.headers['X-RateLimit-Remaining'], '4');
});
