// 端到端集成测试：真实起服务（随机端口 + 临时数据库），覆盖登录链路与 LLM 代理。
// 这些用例沉淀自历次手工验证：注册/登录/防会话固定/退出销毁、
// 配置密文落库/不回显、模型列表转发、上游断线补发错误块。
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// 环境必须在 import index.js 之前就位
const tmpDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rcg-test-')), 'test.sqlite');
process.env.DB_PATH = tmpDb;
process.env.ENCRYPTION_KEY = 'a'.repeat(64);
process.env.SESSION_SECRET = 'test-secret';
process.env.PORT = '0'; // 随机端口

let base = '';
let server;
let fakeUpstream;
let fakeUpstreamPort;
// 假上游行为开关：'ok' 正常流式；'die' 发两块后断线；模型列表始终可用
let upstreamMode = 'ok';

before(async () => {
  // 假上游：模拟 OpenAI 兼容平台（/models + /chat/completions）
  fakeUpstream = http.createServer((req, res) => {
    if (req.url.endsWith('/models')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ id: 'fake-a' }, { id: 'fake-b' }] }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write('data: {"choices":[{"delta":{"content":"你好，"}}]}\n\n');
    res.write('data: {"choices":[{"delta":{"content":"世界"}}]}\n\n');
    if (upstreamMode === 'die') {
      setTimeout(() => res.destroy(), 100); // 不发 [DONE]，硬断
    } else {
      res.write('data: [DONE]\n\n');
      res.end();
    }
  });
  await new Promise((r) => fakeUpstream.listen(0, r));
  fakeUpstreamPort = fakeUpstream.address().port;

  ({ server } = await import('../src/index.js'));
  if (!server.listening) await new Promise((r) => server.once('listening', r));
  base = `http://localhost:${server.address().port}/api/v1`;
});

after(() => {
  server?.close();
  fakeUpstream?.close();
  fs.rmSync(path.dirname(tmpDb), { recursive: true, force: true });
});

const json = { 'Content-Type': 'application/json' };
const cookieOf = (res) => res.headers.get('set-cookie')?.split(';')[0];
const readAll = async (res) => {
  let raw = '';
  const rd = res.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { value, done } = await rd.read();
    if (done) break;
    raw += dec.decode(value, { stream: true });
  }
  return raw;
};

test('登录链路：注册→me→重登录换会话ID→退出后全部 401', async () => {
  const su = await fetch(`${base}/auths/signup`, {
    method: 'POST', headers: json,
    body: JSON.stringify({ name: 't', email: 't1@e.com', password: 'secret1' }),
  });
  assert.equal(su.status, 200);
  const cookieA = cookieOf(su);
  assert.ok(cookieA, '注册应下发会话 cookie');

  const me = await fetch(`${base}/auths/me`, { headers: { Cookie: cookieA } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).email, 't1@e.com');

  // 防会话固定：携带旧 cookie 重登录应换发新会话 ID
  const si = await fetch(`${base}/auths/signin`, {
    method: 'POST', headers: { ...json, Cookie: cookieA },
    body: JSON.stringify({ email: 't1@e.com', password: 'secret1' }),
  });
  assert.equal(si.status, 200);
  const cookieB = cookieOf(si);
  assert.ok(cookieB && cookieB !== cookieA, '登录后必须更换会话 ID');

  // 退出销毁服务端会话，旧 cookie 全部失效
  const so = await fetch(`${base}/auths/signout`, { method: 'POST', headers: { Cookie: cookieB } });
  assert.equal(so.status, 200);
  for (const url of [`${base}/auths/me`, `${base}/llm/config`]) {
    const r = await fetch(url, { headers: { Cookie: cookieB } });
    assert.equal(r.status, 401, `退出后 ${url} 应拒绝`);
  }
});

test('未登录访问受保护接口一律 401', async () => {
  for (const [method, url] of [
    ['GET', `${base}/llm/config`],
    ['GET', `${base}/llm/models`],
    ['POST', `${base}/llm/chat/completions`],
  ]) {
    const r = await fetch(url, { method, headers: json, body: method === 'POST' ? '{}' : undefined });
    assert.equal(r.status, 401, `${method} ${url}`);
  }
});

test('LLM 配置：密文落库、不回显、留空保留旧 Key', async () => {
  const su = await fetch(`${base}/auths/signup`, {
    method: 'POST', headers: json,
    body: JSON.stringify({ name: 't', email: 't2@e.com', password: 'secret1' }),
  });
  const cookie = cookieOf(su);
  const apiUrl = `http://localhost:${fakeUpstreamPort}/v1`;

  const sv = await fetch(`${base}/llm/config`, {
    method: 'PUT', headers: { ...json, Cookie: cookie },
    body: JSON.stringify({ provider: 'custom', apiUrl, apiKey: 'sk-plain-secret', model: 'fake-a' }),
  });
  assert.equal(sv.status, 200);

  // 直接查库确认密文形态
  const { db } = await import('../src/db.js');
  const row = db.prepare(
    "SELECT api_key_encrypted FROM llm_configs WHERE user_id=(SELECT id FROM users WHERE email='t2@e.com')"
  ).get();
  assert.ok(!row.api_key_encrypted.includes('sk-plain-secret'), '库内不得出现明文');

  // 回读只有 hasApiKey 布尔
  const cg = await fetch(`${base}/llm/config`, { headers: { Cookie: cookie } });
  const cfg = await cg.json();
  assert.equal(cfg.hasApiKey, true);
  assert.ok(!JSON.stringify(cfg).includes('sk-plain-secret'), '回读不得回显明文');

  // apiKey 留空更新 → 旧密文保留
  await fetch(`${base}/llm/config`, {
    method: 'PUT', headers: { ...json, Cookie: cookie },
    body: JSON.stringify({ provider: 'custom', apiUrl, apiKey: '', model: 'fake-b' }),
  });
  const row2 = db.prepare(
    "SELECT api_key_encrypted, model FROM llm_configs WHERE user_id=(SELECT id FROM users WHERE email='t2@e.com')"
  ).get();
  assert.equal(row2.api_key_encrypted, row.api_key_encrypted, '留空应保留旧 Key');
  assert.equal(row2.model, 'fake-b');
});

test('模型列表：GET 用已存配置，POST /models/test 用临时参数（密钥在 body）', async () => {
  const su = await fetch(`${base}/auths/signup`, {
    method: 'POST', headers: json,
    body: JSON.stringify({ name: 't', email: 't3@e.com', password: 'secret1' }),
  });
  const cookie = cookieOf(su);
  const apiUrl = `http://localhost:${fakeUpstreamPort}/v1`;

  // 保存前先用临时参数测试连接
  const t = await fetch(`${base}/llm/models/test`, {
    method: 'POST', headers: { ...json, Cookie: cookie },
    body: JSON.stringify({ apiUrl, apiKey: 'sk-x' }),
  });
  assert.equal(t.status, 200);
  assert.deepEqual((await t.json()).data.map((m) => m.id), ['fake-a', 'fake-b']);

  // 保存后 GET 直接用已存配置
  await fetch(`${base}/llm/config`, {
    method: 'PUT', headers: { ...json, Cookie: cookie },
    body: JSON.stringify({ provider: 'custom', apiUrl, apiKey: 'sk-x', model: 'fake-a' }),
  });
  const ms = await fetch(`${base}/llm/models`, { headers: { Cookie: cookie } });
  assert.equal(ms.status, 200);
  assert.equal((await ms.json()).data.length, 2);
});

test('对话代理：正常流式透传；上游中断时补发错误块与 [DONE]', async () => {
  const su = await fetch(`${base}/auths/signup`, {
    method: 'POST', headers: json,
    body: JSON.stringify({ name: 't', email: 't4@e.com', password: 'secret1' }),
  });
  const cookie = cookieOf(su);
  await fetch(`${base}/llm/config`, {
    method: 'PUT', headers: { ...json, Cookie: cookie },
    body: JSON.stringify({
      provider: 'custom',
      apiUrl: `http://localhost:${fakeUpstreamPort}/v1`,
      apiKey: 'sk-x', model: 'fake-a',
    }),
  });
  const ask = () =>
    fetch(`${base}/llm/chat/completions`, {
      method: 'POST', headers: { ...json, Cookie: cookie },
      body: JSON.stringify({ model: 'fake-a', messages: [{ role: 'user', content: 'hi' }] }),
    });

  // 正常路径
  upstreamMode = 'ok';
  let raw = await readAll(await ask());
  assert.ok(raw.includes('你好，') && raw.includes('世界'), '内容透传');
  assert.ok(raw.includes('data: [DONE]'), '正常收尾');
  assert.ok(!raw.includes('sk-x'), '流内不得出现密钥');

  // 上游中断路径：已收内容保留 + 补发错误块 + [DONE]，服务不崩
  upstreamMode = 'die';
  raw = await readAll(await ask());
  assert.ok(raw.includes('你好，'), '已收内容保留');
  assert.ok(raw.includes('上游连接中断'), '补发错误块');
  assert.ok(raw.includes('data: [DONE]'), '补发 [DONE]');

  const health = await fetch(`${base.replace('/api/v1', '')}/api/v1/health`);
  assert.equal((await health.json()).ok, true, '服务进程仍存活');
});
