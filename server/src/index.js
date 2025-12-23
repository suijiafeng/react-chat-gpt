import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
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
    cookie: {
      httpOnly: true, // JS 读不到，防 XSS 窃取会话
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 天
    },
    // 注意：默认 MemoryStore 仅适合开发/演示，服务重启会清空所有会话，
    // 也不支持多实例部署。生产环境请换成 connect-redis 等持久化 store。
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
