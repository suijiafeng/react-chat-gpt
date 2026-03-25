import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import { SqliteSessionStore } from './sessionStore.js';
import authRoutes from './routes/auth.js';
import llmRoutes from './routes/llm.js';

const app = express();

const isProduction = process.env.NODE_ENV === 'production';

// Session 签名密钥：绝不能在生产环境用代码里写死的兜底值，否则任何人都能用公开的
// 密钥伪造会话 cookie 冒充其它用户（且会话已持久化到 SQLite，伪造后重启依旧有效）。
// 生产环境未配置直接启动失败；开发环境允许临时密钥但打印告警。
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  if (isProduction) {
    throw new Error(
      'SESSION_SECRET 未配置：生产环境必须设置一个随机长字符串（如 `openssl rand -hex 32`），否则会话可被伪造'
    );
  }
  console.warn('[warn] 未设置 SESSION_SECRET，使用临时开发密钥——仅限本地开发，切勿用于生产');
}

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
    secret: sessionSecret || 'dev-only-insecure-secret',
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
// 导出 server/app：集成测试用 PORT=0 起随机端口（server.address().port 取实际端口），
// 测试结束 server.close() 干净退出
export const server = app.listen(port, () => {
  console.log(`react-chat-gpt server listening on http://localhost:${server.address().port}`);
});
export { app };
