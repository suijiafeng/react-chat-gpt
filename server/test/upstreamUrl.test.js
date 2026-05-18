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
  rejects('http://169.254.169.254/latest/meta-data/', /本机地址|内网/);
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

test('默认模式下本机地址放行任意端口（Ollama / LM Studio / vLLM 端口各不相同）', () => {
  for (const url of [
    'http://localhost:11434/v1',
    'http://127.0.0.1:11434/v1',
    'http://localhost:1234/v1',
    'http://127.0.0.1:8000/v1',
  ]) {
    assert.ok(parseUpstreamUrl(url), url);
  }
});

test('非本机的明文 http 一律拒绝', () => {
  rejects('http://api.openai.com/v1', /本机地址/);
});

test('ALLOW_LOCAL_UPSTREAM=false（多用户部署）时连本机也拒绝，但公网 https 照常', async () => {
  process.env.ALLOW_LOCAL_UPSTREAM = 'false';
  // 模块级常量在首次 import 时求值，需要独立的模块实例
  const strict = await import(`../src/upstreamUrl.js?strict=${Date.now()}`);
  assert.throws(
    () => strict.parseUpstreamUrl('http://localhost:11434/v1'),
    /ALLOW_LOCAL_UPSTREAM=false/,
  );
  assert.ok(strict.parseUpstreamUrl('https://api.openai.com/v1'));
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
