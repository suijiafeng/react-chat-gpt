import { describe, it, expect } from 'vitest';
import { encryptString, decryptString, isEncrypted } from './keyVault';

// node 环境没有 IndexedDB，直接生成密钥注入（与浏览器主密钥同参数）
const genKey = () =>
  crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

describe('keyVault AES-GCM 加解密', () => {
  it('加密后为 enc: 前缀格式，且不含明文', async () => {
    const key = await genKey();
    const stored = await encryptString('sk-secret-123456', key);
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain('sk-secret');
    expect(stored).not.toContain(btoa('sk-secret-123456'));
  });

  it('同一密钥可解密还原（含中文/特殊字符）', async () => {
    const key = await genKey();
    const plain = 'sk-测试🔑-!@#$%^&*()';
    expect(await decryptString(await encryptString(plain, key), key)).toBe(plain);
  });

  it('每次加密 IV 不同（同明文密文不同）', async () => {
    const key = await genKey();
    const a = await encryptString('same', key);
    const b = await encryptString('same', key);
    expect(a).not.toBe(b);
  });

  it('用错误密钥解密返回空串而非抛错', async () => {
    const stored = await encryptString('secret', await genKey());
    expect(await decryptString(stored, await genKey())).toBe('');
  });

  it('非加密格式/空值安全处理', async () => {
    const key = await genKey();
    expect(await encryptString('', key)).toBe('');
    expect(await decryptString('b64:c2s=', key)).toBe('');
    expect(await decryptString('', key)).toBe('');
    expect(isEncrypted('b64:xx')).toBe(false);
  });
});
