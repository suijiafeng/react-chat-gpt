// 基于现有 better-sqlite3 的 express-session 持久化存储。
//
// 默认 MemoryStore 服务重启会清空所有登录态、也不支持多实例；这里把 session 落到
// 同一个 SQLite 文件里，重启后用户仍保持登录。better-sqlite3 是同步 API，
// 但 Store 约定回调风格，这里用 setImmediate/直接回调把同步结果包成异步接口。

import session from 'express-session';
import { db } from './db.js';

const Store = session.Store;

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions (expires_at);
`);

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 与 index.js 里 cookie.maxAge 保持一致

export class SqliteSessionStore extends Store {
  constructor({ cleanupIntervalMs = 60 * 60 * 1000 } = {}) {
    super();
    this._get = db.prepare('SELECT data, expires_at FROM sessions WHERE sid = ?');
    this._set = db.prepare(
      `INSERT INTO sessions (sid, data, expires_at) VALUES (@sid, @data, @expiresAt)
       ON CONFLICT(sid) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`
    );
    this._touch = db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?');
    this._destroy = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this._clearExpired = db.prepare('DELETE FROM sessions WHERE expires_at <= ?');

    // 周期清理过期会话，避免表无限增长。unref 让定时器不阻止进程退出。
    this._timer = setInterval(() => this._clearExpired.run(Date.now()), cleanupIntervalMs);
    if (typeof this._timer.unref === 'function') this._timer.unref();
  }

  // session.cookie.maxAge 可能为 null（浏览器会话 cookie），此时用默认 TTL 兜底
  _expiresAt(sess) {
    const maxAge = sess?.cookie?.maxAge;
    return Date.now() + (typeof maxAge === 'number' ? maxAge : DEFAULT_TTL_MS);
  }

  get(sid, cb) {
    try {
      const row = this._get.get(sid);
      if (!row) return cb(null, null);
      if (row.expires_at <= Date.now()) {
        this._destroy.run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.data));
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      this._set.run({ sid, data: JSON.stringify(sess), expiresAt: this._expiresAt(sess) });
      cb?.(null);
    } catch (err) {
      cb?.(err);
    }
  }

  touch(sid, sess, cb) {
    try {
      this._touch.run(this._expiresAt(sess), sid);
      cb?.(null);
    } catch (err) {
      cb?.(err);
    }
  }

  destroy(sid, cb) {
    try {
      this._destroy.run(sid);
      cb?.(null);
    } catch (err) {
      cb?.(err);
    }
  }
}
