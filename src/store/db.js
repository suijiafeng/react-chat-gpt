import { openDB } from 'idb';

const DB_NAME = 'chatDB';
const STORE_NAME = 'chatMessages';

// 初始化数据库
export const initDB = async () => {
  return await openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id', // 以消息 id 作为主键
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp'); // 根据时间戳排序
      }
    },
  });
};

// 保存消息到 IndexedDB
export const saveMessageToDB = async (message) => {
  const db = await initDB();
  await db.put(STORE_NAME, { ...message, timestamp: new Date().toISOString() });
};

// 从 IndexedDB 加载所有消息
export const loadMessagesFromDB = async () => {
  const db = await initDB();
  return await db.getAllFromIndex(STORE_NAME, 'timestamp'); // 根据时间戳获取所有消息
};

// 清空聊天历史
export const clearChatHistory = async () => {
  const db = await initDB();
  await db.clear(STORE_NAME); // 清空存储的所有消息
};
