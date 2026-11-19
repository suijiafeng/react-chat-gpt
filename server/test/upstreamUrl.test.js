// 上游地址 SSRF 防护测试：协议白名单、内网地址拦截、本机 Ollama 例外、凭证与重定向。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseUpstreamUrl, isPrivateAddress, UpstreamUrlError } from '../src/upstreamUrl.js';

const rejects = (url, re) =>
  assert.throws(() => parseUpstreamUrl(url), (e) => e instanceof UpstreamUrlError && re.test(e.message), url);

test('放行正常的 https 上游', () => {
  for (const url of [
    'https://api.openai.com/v1',
    'https://api.deepseek.com/v1',
    'https://generativelanguage.googleapis.com/v1beta/openai',
  ]) {
    assert.ok(parseUpstreamUrl(url), url);
  }
});

test('拦截云厂商元数据端点（SSRF 的头号目标）', () => {
  // 默认未开启本机上游时，明文 http 在协议这一层就被拒绝
  rejects('http://169.254.169.254/latest/meta-data/', /ALLOW_LOCAL_UPSTREAM=true|内网|本机地址/);
  rejects('https://169.254.169.254/latest/meta-data/', /内网或本机/);
});

test('拦截各类内网与环回地址', () => {
  for (const url of [
    'https://10.0.0.5:8080/v1',
    'https://172.16.3.4/v1',
    'https://172.31.255.1/v1',
    'https://192.168.1.1/v1',
    'https://127.0.0.1/v1',
    'https://[::1]/v1',
    'https://[fd00::1]/v1',
    'https://100.64.0.1/v1',
    'https://0.0.0.0/v1',
  ]) {
    rejects(url, /内网或本机/);
  }
});

test('IPv4-mapped IPv6 不能绕过（::ffff:10.0.0.1）', () => {
  assert.equal(isPrivateAddress('::ffff:10.0.0.1'), true);
  assert.equal(isPrivateAddress('::ffff:8.8.8.8'), false);
  rejects('https://[::ffff:169.254.169.254]/v1', /内网或本机/);
});

test('172.16/12 的边界判定正确（172.15 与 172.32 属于公网）', () => {
  assert.equal(isPrivateAddress('172.15.0.1'), false);
  assert.equal(isPrivateAddress('172.16.0.1'), true);
  assert.equal(isPrivateAddress('172.31.255.255'), true);
  assert.equal(isPrivateAddress('172.32.0.1'), false);
});

test('默认（未设置 ALLOW_LOCAL_UPSTREAM）拒绝本机 http，只放行公网 https', () => {
  for (const url of [
    'http://localhost:11434/v1',
    'http://127.0.0.1:11434/v1',
    'http://localhost:1234/v1',
    'http://[::1]:8000/v1',
  ]) {
    rejects(url, /ALLOW_LOCAL_UPSTREAM=true/);
  }
  assert.ok(parseUpstreamUrl('https://api.openai.com/v1'));
});

test('非本机的明文 http 一律拒绝', () => {
  rejects('http://api.openai.com/v1', /ALLOW_LOCAL_UPSTREAM=true|本机地址/);
});

test('ALLOW_LOCAL_UPSTREAM 只有严格等于 true 才放行本机，内网与明文公网仍然拒绝', async () => {
  // 同一个测试里顺序改环境变量，避免并行用例互相覆盖 process.env
  for (const value of ['false', '1', 'yes', '']) {
    process.env.ALLOW_LOCAL_UPSTREAM = value;
    const strict = await import(`../src/upstreamUrl.js?strict=${encodeURIComponent(value)}-${Date.now()}`);
    assert.throws(
      () => strict.parseUpstreamUrl('http://localhost:11434/v1'),
      /ALLOW_LOCAL_UPSTREAM=true/,
      `value=${JSON.stringify(value)}`,
    );
    assert.ok(strict.parseUpstreamUrl('https://api.openai.com/v1'));
  }

  process.env.ALLOW_LOCAL_UPSTREAM = 'true';
  const loose = await import(`../src/upstreamUrl.js?local=${Date.now()}`);
  for (const url of [
    'http://localhost:11434/v1',
    'http://127.0.0.1:11434/v1',
    'http://localhost:1234/v1',
    'http://127.0.0.1:8000/v1',
  ]) {
    assert.ok(loose.parseUpstreamUrl(url), url);
  }
  assert.throws(() => loose.parseUpstreamUrl('http://169.254.169.254/latest/meta-data/'), /本机地址/);
  assert.throws(() => loose.parseUpstreamUrl('http://10.0.0.5/v1'), /本机地址/);
  assert.throws(() => loose.parseUpstreamUrl('http://api.openai.com/v1'), /本机地址/);
  assert.throws(() => loose.parseUpstreamUrl('https://127.0.0.1/v1'), /内网或本机/);
  assert.ok(loose.parseUpstreamUrl('https://api.openai.com/v1'));
  delete process.env.ALLOW_LOCAL_UPSTREAM;
});

test('拒绝 http/https 之外的协议', () => {
  rejects('file:///etc/passwd', /协议/);
  rejects('gopher://127.0.0.1:6379/_INFO', /协议/);
});

test('拒绝 URL 内嵌凭证（会被转发给上游并落进日志）', () => {
  rejects('https://user:pass@api.openai.com/v1', /用户名或密码/);
});

test('空地址与非法 URL 给出可读提示', () => {
  rejects('', /请填写/);
  rejects('   ', /请填写/);
  rejects('api.openai.com/v1', /合法的 URL/);
});

test('通过校验后返回规范化 URL', () => {
  assert.equal(parseUpstreamUrl('  https://api.openai.com/v1  ').toString(), 'https://api.openai.com/v1');
});
