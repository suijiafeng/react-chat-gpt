// API Key 加解密模块测试：往返一致性、占位密钥拒绝、格式/篡改容错。
import { test } from 'node:test';
import assert from 'node:assert/strict';

const REAL_KEY = 'a'.repeat(64);

test('加密后可解密还原，且密文不含明文', async () => {
  process.env.ENCRYPTION_KEY = REAL_KEY;
  const { encrypt, decrypt } = await import('../src/crypto.js');
  const secret = 'sk-test-1234567890';
  const stored = encrypt(secret);
  assert.notEqual(stored, secret);
  assert.ok(!stored.includes(secret), '密文不应包含明文');
  assert.equal(decrypt(stored), secret);
});

test('空串直通（未配置 Key 的场景）', async () => {
  process.env.ENCRYPTION_KEY = REAL_KEY;
  const { encrypt, decrypt } = await import('../src/crypto.js');
  assert.equal(encrypt(''), '');
  assert.equal(decrypt(''), '');
});

test('拒绝 .env.example 的占位密钥（全 0）', async () => {
  process.env.ENCRYPTION_KEY = '0'.repeat(64);
  const { encrypt } = await import('../src/crypto.js');
  assert.throws(() => encrypt('x'), /占位值/);
});

test('拒绝非 hex 或长度不对的密钥', async () => {
  const { encrypt } = await import('../src/crypto.js');
  process.env.ENCRYPTION_KEY = 'zz'.repeat(32); // 长度对但非 hex
  assert.throws(() => encrypt('x'), /64 位十六进制/);
  process.env.ENCRYPTION_KEY = 'abc'; // 太短
  assert.throws(() => encrypt('x'), /64 位十六进制/);
});

test('密文被篡改时解密返回空串而不是抛错', async () => {
  process.env.ENCRYPTION_KEY = REAL_KEY;
  const { encrypt, decrypt } = await import('../src/crypto.js');
  const stored = encrypt('secret');
  const tampered = stored.slice(0, -2) + (stored.endsWith('00') ? '11' : '00');
  assert.equal(decrypt(tampered), '');
  assert.equal(decrypt('不是合法格式'), '');
});
