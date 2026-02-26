import request from './config';
import { WEBUI_API_BASE_URL, USE_LOCAL_DATA } from '../constants';
import { getUserByEmail, createUser } from '../store/db';
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

    const user = await getUserByEmail(email);
    if (!user) throw new Error('账号不存在');

    const hash = await hashPassword(password, user.salt);
    if (!safeCompare(hash, user.passwordHash)) throw new Error('密码错误');

    return saveSession(user);
  }

  // 后端接口（USE_LOCAL_DATA = false 时生效）
  const res = await request.post(`${WEBUI_API_BASE_URL}/auths/signin`, { email, password });
  return saveSession(res.data);
};

// ──────────────────────────────────────────────
// 注销
// ──────────────────────────────────────────────

export const userSignOut = () => {
  // 后端模式下必须同时销毁服务端会话：httpOnly cookie 前端删不掉，
  // 只清 localStorage 的话 cookie 在 7 天有效期内依然能调 /llm/* 等受保护接口。
  // fire-and-forget：本地清理不应被网络失败阻塞（下线的兜底是被动 401 处理）。
  if (!USE_LOCAL_DATA) {
    request.post(`${WEBUI_API_BASE_URL}/auths/signout`).catch(() => {});
  }
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('demo_mode');
};
