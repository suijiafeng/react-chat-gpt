import request from './config';
import { WEBUI_API_BASE_URL, USE_LOCAL_DATA } from '../constants';
import { getUserByEmail, createUser, updateUserName, seedDemoUser, clearAllSessions } from '../store/db';
import { wipeCurrentAccountConfig } from '../store/llmConfig';
import { DEMO_ACCOUNT } from '../constants';
import i18n from '../locales/i18n';
import { generateSalt, hashPassword, safeCompare } from '../utils/crypto';

const SESSION_KEY = 'auth_session';

// ──────────────────────────────────────────────
// Session helpers
// ──────────────────────────────────────────────

export const getSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveSession = (user) => {
  // 只存非敏感字段
  const session = {
    id: user.id,
    name: user.name,
    email: user.email,
    profile_image_url: user.profile_image_url,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
};

// ──────────────────────────────────────────────
// 注册
// ──────────────────────────────────────────────

export const userSignUp = async ({ name, email, password, profile_image_url = '' }) => {
  if (USE_LOCAL_DATA) {
    // 本地模式：IndexedDB 实现
    if (!name?.trim()) throw new Error('用户名不能为空');
    if (!email?.trim()) throw new Error('邮箱不能为空');
    if (!password || password.length < 6) throw new Error('密码长度至少 6 位');

    const existing = await getUserByEmail(email);
    if (existing) throw new Error('该邮箱已被注册');

    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    const user = await createUser({ name: name.trim(), email, passwordHash, salt, profile_image_url });
    return saveSession(user);
  }

  // 后端接口（USE_LOCAL_DATA = false 时生效）
  const res = await request.post(`${WEBUI_API_BASE_URL}/auths/signup`, { name, email, password, profile_image_url });
  return saveSession(res.data);
};

// ──────────────────────────────────────────────
// 登录
// ──────────────────────────────────────────────

export const userSignIn = async ({ email, password }) => {
  if (USE_LOCAL_DATA) {
    // 本地模式：IndexedDB 实现
    if (!email?.trim()) throw new Error('邮箱不能为空');
    if (!password) throw new Error('密码不能为空');

    let user = await getUserByEmail(email);

    // 演示账号自愈：预置种子是页面加载后异步写入的，用户打开页面立刻登录、
    // 或老库里的种子还是旧邮箱/旧密码时，这里会查不到或对不上。
    // 只要输入的是文档公示的演示账号，就地重新补种一次再校验，
    // 避免"按 README 输入默认账号却提示不存在/密码错误"的困惑。
    const isDemoCredentials =
      email.trim().toLowerCase() === DEMO_ACCOUNT.email && password === DEMO_ACCOUNT.password;
    if (!user && isDemoCredentials) {
      await seedDemoUser();
      user = await getUserByEmail(email);
    }
    // 统一模糊报错："账号不存在"和"密码错误"分开提示会让攻击者能批量验证
    // 哪些邮箱注册过（账号枚举），一律只说"邮箱或密码不正确"
    const invalidCredentials = () => new Error(i18n.t('invalidCredentials'));
    if (!user) throw invalidCredentials();

    let hash = await hashPassword(password, user.salt);
    if (!safeCompare(hash, user.passwordHash)) {
      if (!isDemoCredentials) throw invalidCredentials();
      // 老种子密码对不上：强制覆盖为当前版本的演示账号后重试
      await seedDemoUser({ force: true });
      user = await getUserByEmail(email);
      hash = await hashPassword(password, user.salt);
      if (!safeCompare(hash, user.passwordHash)) throw invalidCredentials();
    }

    return saveSession(user);
  }

  // 后端接口（USE_LOCAL_DATA = false 时生效）
  const res = await request.post(`${WEBUI_API_BASE_URL}/auths/signin`, { email, password });
  return saveSession(res.data);
};

// ──────────────────────────────────────────────
// 个人资料
// ──────────────────────────────────────────────

// 更新昵称。三种登录形态分别持久化：
// - 免登录演示（demo_mode）：写 localStorage 的 demo_name，resolveAuthState 恢复时读取；
// - 本地账号（auth_session + IndexedDB）：同步更新 users 表与 session；
// - 后端模式：仅更新本地 session 展示（服务端未提供改名接口，属已知限制）。
export const updateProfileName = async (name) => {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new Error('用户名不能为空');

  if (localStorage.getItem('demo_mode') === 'true') {
    localStorage.setItem('demo_name', trimmed);
    return trimmed;
  }

  const session = getSession();
  if (session) {
    if (USE_LOCAL_DATA && session.id) {
      await updateUserName(session.id, trimmed);
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, name: trimmed }));
  }
  return trimmed;
};

// ──────────────────────────────────────────────
// 注销
// ──────────────────────────────────────────────

export const userSignOut = async () => {
  // 后端模式下必须同时销毁服务端会话：httpOnly cookie 前端删不掉，
  // 只清 localStorage 的话 cookie 在 7 天有效期内依然能调 /llm/* 等受保护接口。
  // fire-and-forget：本地清理不应被网络失败阻塞（下线的兜底是被动 401 处理）。
  if (!USE_LOCAL_DATA) {
    request.post(`${WEBUI_API_BASE_URL}/auths/signout`).catch(() => {});
  }

  // 免登录体验是一次性的：退出即销毁该体验身份的全部数据
  // （会话与消息、LLM 配置及加密密钥密文、改过的昵称），下次体验从零开始。
  // 必须在清掉 demo_mode 标记之前执行——数据归属就是按这个标记解析的。
  if (localStorage.getItem('demo_mode') === 'true') {
    await clearAllSessions().catch(() => {});
    wipeCurrentAccountConfig();
    localStorage.removeItem('demo_name');
  }

  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('demo_mode');
};
