import { openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import { generateSalt, hashPassword } from '../utils/crypto';
import { encryptString, decryptString, encryptJson, decryptJson } from '../utils/keyVault';
import { DEMO_ACCOUNT } from '../constants';

const DEMO_USER_ID = 'demo-user-fixed-id';

const DB_NAME = 'chatDB';
const DB_VERSION = 4;
const SESSIONS_STORE = 'chatSessions';
const MESSAGES_STORE = 'chatMessages';
const USERS_STORE = 'users';

// ──────────────────────────────────────────────
// 数据库初始化
// ──────────────────────────────────────────────

export const initDB = async () => {
  return await openDB(DB_NAME, DB_VERSION, {
    async upgrade(db, oldVersion, newVersion, transaction) {
      // v1 → v2: 重建 messages 表（新增 sessionId 索引）
      if (oldVersion < 2) {
        if (db.objectStoreNames.contains(MESSAGES_STORE)) {
          db.deleteObjectStore(MESSAGES_STORE);
        }
      }

      let msgStore;
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const sessionStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        sessionStore.createIndex('updatedAt', 'updatedAt');
      }

      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        msgStore = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
        msgStore.createIndex('sessionId', 'sessionId');
        msgStore.createIndex('timestamp', 'timestamp');
      } else {
        msgStore = transaction.objectStore(MESSAGES_STORE);
      }

      // v2 → v3: 新增 users 表
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(USERS_STORE)) {
          const userStore = db.createObjectStore(USERS_STORE, { keyPath: 'id' });
          userStore.createIndex('email', 'email', { unique: true });
        }
      }

      // v3 → v4: 新增 sessionId_timestamp 联合索引
      if (oldVersion < 4) {
        if (msgStore && !msgStore.indexNames.contains('sessionId_timestamp')) {
          msgStore.createIndex('sessionId_timestamp', ['sessionId', 'timestamp']);
        }
      }
    },
  });
};

// 预置演示账号（首次启动时写入）。
// 账号固定 id，改邮箱/密码时按 id 覆盖写入即可完成升级——老用户库里那条
// demo@example.com 记录会被同一条 id 直接替换，不会残留一个还能用的弱口令账号。
// force：无视"邮箱已是最新"的跳过逻辑强制覆盖——用于登录自愈场景
// （库里躺着同邮箱但旧密码的种子时，必须重写才能让公示的演示密码生效）
export const seedDemoUser = async ({ force = false } = {}) => {
  const db = await initDB();
  const existing = await db.get(USERS_STORE, DEMO_USER_ID);
  if (!force && existing?.email === DEMO_ACCOUNT.email) return; // 已是最新的演示账号，跳过

  const salt = generateSalt();
  const passwordHash = await hashPassword(DEMO_ACCOUNT.password, salt);
  await db.put(USERS_STORE, {
    id: DEMO_USER_ID,
    name: DEMO_ACCOUNT.name,
    email: DEMO_ACCOUNT.email,
    passwordHash,
    salt,
    profile_image_url: '',
    createdAt: new Date().toISOString(),
  });
};

// ──────────────────────────────────────────────
// 用户（User）操作
// ──────────────────────────────────────────────

export const getUserByEmail = async (email) => {
  const db = await initDB();
  return db.getFromIndex(USERS_STORE, 'email', email.toLowerCase().trim());
};

export const createUser = async ({ name, email, passwordHash, salt, profile_image_url = '' }) => {
  const db = await initDB();
  const user = {
    id: uuidv4(),
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    salt,
    profile_image_url,
    createdAt: new Date().toISOString(),
  };
  await db.put(USERS_STORE, user);
  return user;
};

// ──────────────────────────────────────────────
// 聊天内容的落盘加密
//
// 会话标题、消息正文、图片与附件都属于用户的私密内容，此前是明文躺在 IndexedDB 里——
// 打开 DevTools 的 Application 面板、或任何能读到同源 IDB 的工具都能直接翻阅。
// 现在这些字段统一用 keyVault 的主密钥（AES-256-GCM，不可导出的 CryptoKey）加密后再落盘。
//
// 刻意保持明文的字段：id / sessionId / timestamp / isUser / createdAt / updatedAt / model。
// 它们是索引和排序的依据（加密后 sessionId_timestamp 索引就没法用了），且本身不含对话内容，
// 泄露的只是"某时刻有过一条消息"这种元数据。
//
// 老实说：和 keyVault 一样，这是"不落明文 + 纵深防御"，不是对抗同源 XSS 的护城河——
// 页面里跑起来的恶意代码同样能调用这里的解密函数。
// ──────────────────────────────────────────────

// 消息里需要加密的内容字段；其余字段是元数据，原样保留
const MESSAGE_SECRET_FIELDS = ['text', 'images', 'attachments'];

const encryptMessageRecord = async (message, sessionId) => {
  const { id, isUser, timestamp, ...rest } = message;
  const secret = {};
  const meta = {};
  for (const [k, v] of Object.entries(rest)) {
    if (MESSAGE_SECRET_FIELDS.includes(k)) secret[k] = v;
    else meta[k] = v;
  }
  return {
    ...meta,
    id,
    sessionId,
    isUser,
    timestamp: timestamp || new Date().toISOString(),
    enc: await encryptJson(secret),
  };
};

// 读出的记录还原成组件直接可用的形状。
// 兼容三种情况：新的密文记录、加密上线前写入的明文存量、以及解不开的坏记录
// （主密钥被清空时不该整页崩掉，降级成一条带标记的空消息，用户能看到出了什么事）。
const decryptMessageRecord = async (record) => {
  if (!record?.enc) return record; // 明文存量
  const { enc, ...meta } = record;
  const secret = await decryptJson(enc);
  if (secret === null) {
    return { ...meta, text: '（本地密钥已失效，无法解密这条消息）', undecryptable: true };
  }
  return { ...meta, ...secret };
};

// 明文存量惰性升级为密文：读到就顺手重写一次。
// 不 await、失败也不管——迁移失败顶多下次再试，绝不该拖慢或阻断读取。
const migrateMessageIfPlain = (db, record) => {
  if (record?.enc || !record?.id) return;
  encryptMessageRecord(record, record.sessionId)
    .then((encrypted) => db.put(MESSAGES_STORE, encrypted))
    .catch(() => {});
};

// ──────────────────────────────────────────────
// 会话（Session）操作
// ──────────────────────────────────────────────

// 当前登录用户 id：会话数据按用户隔离的依据。
// - 免登录演示：固定的演示用户 id（与默认账号登录是同一个演示身份，数据互通是预期行为）；
// - 账号登录：auth_session 里的用户 id。
// 直接读 localStorage 而不 import apis/auths，避免 db ↔ auths 循环依赖。
const currentUserId = () => {
  if (localStorage.getItem('demo_mode') === 'true') return DEMO_USER_ID;
  try {
    return JSON.parse(localStorage.getItem('auth_session'))?.id || null;
  } catch {
    return null;
  }
};

export const createSession = async (title = '新对话', model = '') => {
  const db = await initDB();
  const now = new Date().toISOString();
  const session = {
    id: uuidv4(),
    model,
    createdAt: now,
    updatedAt: now,
    userId: currentUserId(),
    titleEnc: await encryptString(title),
  };
  await db.put(SESSIONS_STORE, session);
  // 返回给调用方的是明文形状，存储形态不外泄到上层
  return { id: session.id, title, model, createdAt: now, updatedAt: now };
};

const decryptSession = async (session) => {
  if (!session) return session;
  let result = session;
  if (session.titleEnc) {
    const { titleEnc, ...meta } = result;
    const title = await decryptString(titleEnc);
    result = { ...meta, title: title || '（无法解密的会话）' };
  }
  // 每会话系统提示词：与标题同样加密落盘，读出时还原为明文字段
  if (session.systemPromptEnc) {
    const { systemPromptEnc, ...meta } = result;
    result = { ...meta, systemPrompt: (await decryptString(systemPromptEnc)) || '' };
  }
  return result;
};

// 置顶优先的稳定排序：pinned 在前，组内保持传入顺序（即 updatedAt 倒序）。
// 抽成纯函数便于单测，也让排序规则只有一处定义。
export const sortSessions = (sessions) =>
  [...sessions].sort((a, b) => (b.pinned === true) - (a.pinned === true));

// 按用户过滤会话（数据隔离的唯一判断点，纯函数便于单测）。
// userId 为空的存量会话视为"隔离上线前的历史数据"，由当前用户继承（见 getAllSessions 的惰性迁移）。
export const filterSessionsByUser = (sessions, userId) =>
  sessions.filter((s) => !s.userId || s.userId === userId);

export const setSessionPinned = async (sessionId, pinned) => {
  const db = await initDB();
  const session = await db.get(SESSIONS_STORE, sessionId);
  if (!session) return;
  // 刻意不动 updatedAt：置顶不该改变"最近活跃"的语义
  await db.put(SESSIONS_STORE, { ...session, pinned: Boolean(pinned) });
};

export const getAllSessions = async () => {
  const db = await initDB();
  const activeUserId = currentUserId();
  const all = await db.getAllFromIndex(SESSIONS_STORE, 'updatedAt');
  // 数据隔离：只返回当前用户的会话（无 userId 的存量视为当前用户的历史数据）
  const ownSessions = filterSessionsByUser(all.reverse(), activeUserId);
  const decrypted = await Promise.all(ownSessions.map(decryptSession));
  // 存量惰性升级（不阻塞列表渲染）：
  // - 明文标题 → 加密；
  // - 无 userId 的隔离前旧数据 → 归属当前用户，之后其他账号不再看到
  ownSessions
    .filter((s) => s && (!s.titleEnc || !s.userId))
    .forEach((s) => {
      const migrateSessionRecord = async () => {
        const record = { ...s, userId: s.userId || activeUserId };
        if (!s.titleEnc) {
          delete record.title;
          record.titleEnc = await encryptString(s.title || '');
        }
        await db.put(SESSIONS_STORE, record);
      };
      migrateSessionRecord().catch(() => {});
    });
  return sortSessions(decrypted);
};

// 会话归属校验：属于其他账号的会话按不存在处理。
// 会话 id 虽是不可猜的 UUID，但既然做了隔离，直接持有 URL 也不该能读到别人的会话
const resolveOwnedSession = (session) => {
  if (!session) return null;
  if (session.userId && session.userId !== currentUserId()) return null;
  return session;
};

export const getSessionById = async (sessionId) => {
  const db = await initDB();
  return decryptSession(resolveOwnedSession(await db.get(SESSIONS_STORE, sessionId)));
};

export const setSessionSystemPrompt = async (sessionId, systemPrompt) => {
  const db = await initDB();
  const session = await db.get(SESSIONS_STORE, sessionId);
  if (!session) return;
  const meta = { ...session };
  delete meta.systemPromptEnc;
  const trimmed = (systemPrompt || '').trim();
  // 清空时直接移除字段，避免留一条加密的空串
  if (trimmed) meta.systemPromptEnc = await encryptString(trimmed);
  await db.put(SESSIONS_STORE, meta);
};

export const updateSessionTitle = async (sessionId, title) => {
  const db = await initDB();
  const session = await db.get(SESSIONS_STORE, sessionId);
  if (!session) return;
  const meta = { ...session };
  delete meta.title; // 顺带清掉明文存量字段，改名即完成该会话的迁移
  await db.put(SESSIONS_STORE, {
    ...meta,
    titleEnc: await encryptString(title),
    updatedAt: new Date().toISOString(),
  });
};

export const touchSession = async (sessionId) => {
  const db = await initDB();
  const session = await db.get(SESSIONS_STORE, sessionId);
  if (!session) return;
  await db.put(SESSIONS_STORE, { ...session, updatedAt: new Date().toISOString() });
};

export const deleteSession = async (sessionId) => {
  const db = await initDB();
  const messages = await db.getAllFromIndex(MESSAGES_STORE, 'sessionId', sessionId);
  const tx = db.transaction(MESSAGES_STORE, 'readwrite');
  await Promise.all(messages.map((msg) => tx.store.delete(msg.id)));
  await tx.done;
  await db.delete(SESSIONS_STORE, sessionId);
};

// ──────────────────────────────────────────────
// 消息（Message）操作
// ──────────────────────────────────────────────

export const saveMessageToDB = async (message, sessionId) => {
  const db = await initDB();
  await db.put(MESSAGES_STORE, await encryptMessageRecord({ ...message, timestamp: null }, sessionId));
};

export const loadMessagesBySessionPaged = async (sessionId, limit = 30, offset = 0) => {
  const db = await initDB();
  // 数据隔离：其他账号的会话即使拿到 URL 也读不到消息
  if (!resolveOwnedSession(await db.get(SESSIONS_STORE, sessionId))) return [];
  const tx = db.transaction(MESSAGES_STORE, 'readonly');
  const index = tx.store.index('sessionId_timestamp');
  const range = IDBKeyRange.bound([sessionId, ''], [sessionId, '\uffff']);
  let cursor = await index.openCursor(range, 'prev');

  if (offset > 0 && cursor) {
    try {
      await cursor.advance(offset);
    } catch {
      cursor = null;
    }
  }

  const records = [];
  while (cursor && records.length < limit) {
    records.push(cursor.value);
    cursor = await cursor.continue();
  }

  const messages = await Promise.all(records.reverse().map(decryptMessageRecord));
  records.forEach((record) => migrateMessageIfPlain(db, record));
  return messages;
};

// 删除单条消息（不存在时静默忽略）
export const deleteMessageFromDB = async (messageId) => {
  const db = await initDB();
  await db.delete(MESSAGES_STORE, messageId);
};

// 批量删除消息（编辑消息分叉重发时，清掉该消息之后的所有记录）
export const deleteMessagesByIds = async (messageIds) => {
  if (!messageIds?.length) return;
  const db = await initDB();
  const tx = db.transaction(MESSAGES_STORE, 'readwrite');
  await Promise.all(messageIds.map((id) => tx.store.delete(id)));
  await tx.done;
};
