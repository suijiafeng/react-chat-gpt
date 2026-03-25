// SQLite 数据层：用户表 + 每用户一份 LLM 接入配置。
// better-sqlite3 是同步 API，路由里直接调用即可，不需要 await。

import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_PATH 可注入：集成测试指到临时文件，避免污染真实开发库；也便于部署时挂载数据卷
const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'app.sqlite');

export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    profile_image_url TEXT DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS llm_configs (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'custom',
    api_url TEXT NOT NULL DEFAULT '',
    api_key_encrypted TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  );
`);

// ──────────────────────────────────────────────
// 用户
// ──────────────────────────────────────────────

export const findUserByEmail = (email) =>
  db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());

export const findUserById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

export const insertUser = (user) => {
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, profile_image_url, created_at)
     VALUES (@id, @name, @email, @password_hash, @profile_image_url, @created_at)`
  ).run(user);
  return findUserById(user.id);
};

// ──────────────────────────────────────────────
// LLM 配置
// ──────────────────────────────────────────────

export const getLlmConfig = (userId) =>
  db.prepare('SELECT * FROM llm_configs WHERE user_id = ?').get(userId);

export const upsertLlmConfig = (userId, { provider, apiUrl, apiKeyEncrypted, model }) => {
  db.prepare(
    `INSERT INTO llm_configs (user_id, provider, api_url, api_key_encrypted, model, updated_at)
     VALUES (@userId, @provider, @apiUrl, @apiKeyEncrypted, @model, @updatedAt)
     ON CONFLICT(user_id) DO UPDATE SET
       provider = excluded.provider,
       api_url = excluded.api_url,
       api_key_encrypted = excluded.api_key_encrypted,
       model = excluded.model,
       updated_at = excluded.updated_at`
  ).run({
    userId,
    provider,
    apiUrl,
    apiKeyEncrypted,
    model,
    updatedAt: new Date().toISOString(),
  });
};
