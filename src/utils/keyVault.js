// API Key 的本地加密仓库。
//
// 方案：AES-256-GCM 加密后存 localStorage（格式 enc:<iv b64>:<密文 b64>），
// 主密钥是"不可导出"的 CryptoKey，保存在 IndexedDB（与 localStorage 相互独立）。
// 这样单独拿到 localStorage 的内容（云备份、同步、某些扩展的批量读取、
// 直接翻 DevTools Application 面板）都无法还原出明文 key。
//
// 诚实说明：纯前端应用没有绝对安全的密钥存放处——同源的 XSS 代码在运行时
// 依然可以调用这里的解密函数。本模块是"不落明文 + 纵深防御"，
// 对安全要求高的部署请使用服务器托管模式（key 只存在服务端）。

const DB_NAME = 'keyVault';
const STORE = 'keys';
const MASTER_ID = 'master';
const PREFIX = 'enc:';

let masterKeyPromise = null;

const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const idbGet = (db, key) =>
  new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const idbPut = (db, key, value) =>
  new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

/** 获取（首次自动生成）主密钥。extractable=false：无法被导出成字节序列 */
export const getMasterKey = () => {
  if (!masterKeyPromise) {
    masterKeyPromise = (async () => {
      const db = await openDb();
      let key = await idbGet(db, MASTER_ID);
      if (!key) {
        key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
          'encrypt',
          'decrypt',
        ]);
        await idbPut(db, MASTER_ID, key);
      }
      return key;
    })();
    // 失败（如隐私模式禁 IDB）不缓存 rejected promise，下次可重试
    masterKeyPromise.catch(() => {
      masterKeyPromise = null;
    });
  }
  return masterKeyPromise;
};

const bytesToB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** 是否为本模块加密后的存储格式 */
export const isEncrypted = (stored) => typeof stored === 'string' && stored.startsWith(PREFIX);

/**
 * 加密字符串 → 'enc:<iv>:<ct>'。
 * @param {CryptoKey} [key] 可注入密钥（单测用），缺省用 IndexedDB 主密钥
 */
export const encryptString = async (plain, key) => {
  if (!plain) return '';
  const master = key || (await getMasterKey());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    master,
    new TextEncoder().encode(plain)
  );
  return `${PREFIX}${bytesToB64(iv)}:${bytesToB64(ct)}`;
};

/**
 * 解密 'enc:<iv>:<ct>' → 明文。非本格式原样返回空串；解密失败返回空串
 * （主密钥丢失/被清空时的兜底：让用户重填 key，而不是让应用崩掉）。
 */
export const decryptString = async (stored, key) => {
  if (!isEncrypted(stored)) return '';
  try {
    const [ivB64, ctB64] = stored.slice(PREFIX.length).split(':');
    const master = key || (await getMasterKey());
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(ivB64) },
      master,
      b64ToBytes(ctB64)
    );
    return new TextDecoder().decode(plain);
  } catch {
    return '';
  }
};
