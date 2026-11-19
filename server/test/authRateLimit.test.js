// 登录/注册限流：真实起服务，确认超限返回 429、不创建账号，且两条接口各自计数。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rcg-auth-rl-')), 'test.sqlite');
process.env.DB_PATH = tmpDb;
process.env.ENCRYPTION_KEY = 'b'.repeat(64);
process.env.SESSION_SECRET = 'test-secret';
process.env.PORT = '0';
process.env.AUTH_SIGNIN_WINDOW_MS = '60000';
process.env.AUTH_SIGNIN_MAX = '3';
process.env.AUTH_SIGNUP_WINDOW_MS = '60000';
process.env.AUTH_SIGNUP_MAX = '2';

let base = '';
let server;

before(async () => {
  ({ server } = await import('../src/index.js'));
  if (!server.listening) await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});

after(() => {
  server?.close();
  fs.rmSync(path.dirname(tmpDb), { recursive: true, force: true });
});

const json = { 'Content-Type': 'application/json' };

const signup = (email) =>
  fetch(`${base}/auths/signup`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ name: 't', email, password: 'secret1' }),
  });

const signin = (email, password) =>
  fetch(`${base}/auths/signin`, {
    method: 'POST',
    headers: json,
    body: JSON.stringify({ email, password }),
  });

test('注册与登录按 IP 限流，超限 429 且被拒的注册不落库', async () => {
  for (const email of ['ok1@e.com', 'ok2@e.com']) {
    const res = await signup(email);
    assert.equal(res.status, 200, email);
  }

  const blocked = await signup('blocked@e.com');
  assert.equal(blocked.status, 429);
  assert.match((await blocked.json()).message, /注册/);
  assert.ok(Number(blocked.headers.get('retry-after')) > 0);

  const { db } = await import('../src/db.js');
  assert.equal(
    db.prepare('SELECT id FROM users WHERE email = ?').get('blocked@e.com'),
    undefined,
    '超限请求不应创建用户',
  );

  // 登录计数与注册分开：注册已打满时，正确密码仍能登录
  const ok = await signin('ok1@e.com', 'secret1');
  assert.equal(ok.status, 200);

  const bad1 = await signin('ok1@e.com', 'wrong');
  const bad2 = await signin('ok1@e.com', 'wrong');
  assert.equal(bad1.status, 401);
  assert.equal(bad2.status, 401);

  const limited = await signin('ok1@e.com', 'secret1');
  assert.equal(limited.status, 429);
  assert.match((await limited.json()).message, /登录/);
  assert.equal(limited.headers.get('x-ratelimit-limit'), '3');
});
