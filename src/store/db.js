import { openDB } from 'idb';
import { v4 as uuidv4 } from 'uuid';
import { generateSalt, hashPassword } from '../utils/crypto';

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

// 预置演示账号（首次启动时写入）
export const seedDemoUser = async () => {
  const db = await initDB();
  const existing = await db.getFromIndex(USERS_STORE, 'email', 'demo@example.com');
  if (existing) return; // 已存在，跳过

  const salt = generateSalt();
  const passwordHash = await hashPassword('demo123', salt);
  await db.put(USERS_STORE, {
    id: 'demo-user-fixed-id',
    name: 'Demo User',
    email: 'demo@example.com',
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
// 会话（Session）操作
// ──────────────────────────────────────────────

export const createSession = async (title = '新对话', model = '') => {
  const db = await initDB();
  const now = new Date().toISOString();
  const session = { id: uuidv4(), title, model, createdAt: now, updatedAt: now };
  await db.put(SESSIONS_STORE, session);
  return session;
};

export const getAllSessions = async () => {
  const db = await initDB();
  const all = await db.getAllFromIndex(SESSIONS_STORE, 'updatedAt');
  return all.reverse();
};

export const updateSessionTitle = async (sessionId, title) => {
  const db = await initDB();
  const session = await db.get(SESSIONS_STORE, sessionId);
  if (!session) return;
  await db.put(SESSIONS_STORE, { ...session, title, updatedAt: new Date().toISOString() });
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
  await db.put(MESSAGES_STORE, {
    ...message,
    sessionId,
    timestamp: new Date().toISOString(),
  });
};

export const loadMessagesBySession = async (sessionId) => {
  const db = await initDB();
  const messages = await db.getAllFromIndex(MESSAGES_STORE, 'sessionId', sessionId);
  return messages.sort((a, b) => (a.timestamp > b.timestamp ? 1 : -1));
};

export const loadMessagesBySessionPaged = async (sessionId, limit = 30, offset = 0) => {
  const db = await initDB();
  const tx = db.transaction(MESSAGES_STORE, 'readonly');
  const index = tx.store.index('sessionId_timestamp');
  const range = IDBKeyRange.bound([sessionId, ''], [sessionId, '\uffff']);
  let cursor = await index.openCursor(range, 'prev');

  if (offset > 0 && cursor) {
    try {
      await cursor.advance(offset);
    } catch (e) {
      cursor = null;
    }
  }

  const messages = [];
  while (cursor && messages.length < limit) {
    messages.push(cursor.value);
    cursor = await cursor.continue();
  }

  return messages.reverse();
};

export const clearSessionMessages = async (sessionId) => {
  const db = await initDB();
  const messages = await db.getAllFromIndex(MESSAGES_STORE, 'sessionId', sessionId);
  const tx = db.transaction(MESSAGES_STORE, 'readwrite');
  await Promise.all(messages.map((msg) => tx.store.delete(msg.id)));
  await tx.done;
};
