import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { SqliteSessionStore } from './sessionStore.js';
import authRoutes from './routes/auth.js';
import llmRoutes from './routes/llm.js';

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // 允许携带 session cookie，前端 axios/fetch 需配套开启 withCredentials
  })
);
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret',
    resave: false,
    saveUninitialized: false,
    // 会话落到 SQLite（复用同一份 better-sqlite3 连接），服务重启后登录态不丢失，
    // 替代默认 MemoryStore。单机场景足够；多实例部署可再换 Redis 等共享 store。
    store: new SqliteSessionStore(),
    cookie: {
      httpOnly: true, // JS 读不到，防 XSS 窃取会话
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    },
  })
);

// 路由形状贴合前端 WEBUI_API_BASE_URL = `${WEBUI_BASE_URL}/api/v1`
app.use('/api/v1/auths', authRoutes);
app.use('/api/v1/llm', llmRoutes);

app.get('/api/v1/health', (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`react-chat-gpt server listening on http://localhost:${port}`);
});
