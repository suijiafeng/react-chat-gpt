// 对称加密用户的 LLM API Key，落库前加密、读出后解密。
// 相比前端 Base64 编码（只是防止一眼看到），这里是真正的 AES-256-GCM 加密——
// 密钥只存在服务端环境变量里，浏览器和数据库文件本身都拿不到明文。

import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

const getKey = () => {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('ENCRYPTION_KEY 未配置或长度不是 64 位十六进制（32 字节），请检查 .env');
  }
  return Buffer.from(hex, 'hex');
};

/** 加密明文，返回 "iv:authTag:ciphertext"（均为 hex），空字符串直接返回空串 */
export const encrypt = (plainText) => {
  if (!plainText) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
};

/** 解密 encrypt() 产出的字符串；格式不对或密钥不匹配时返回空串而不是抛错 */
export const decrypt = (stored) => {
  if (!stored) return '';
  try {
    const [ivHex, authTagHex, dataHex] = stored.split(':');
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
};
