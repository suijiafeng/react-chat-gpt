// 登录注册路由。
// 响应体形状特意贴合前端 src/apis/auths.js 里 saveSession() 的预期字段
// （id / name / email / profile_image_url），这样前端 USE_LOCAL_DATA=false 时
// 已有的调用代码不需要改动，只需把 VITE_WEBUI_BASE_URL 指向这个服务即可。

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { findUserByEmail, findUserById, insertUser } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

const toPublicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  profile_image_url: user.profile_image_url || '',
});

// 登录/注册成功后建立会话：先 regenerate 更换会话 ID 再写入 userId，
// 防会话固定攻击——认证前的匿名会话 ID 不应在认证后继续有效。
const establishSession = (req, res, user) => {
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ message: '会话创建失败，请重试' });
    req.session.userId = user.id;
    res.json(toPublicUser(user));
  });
};

router.post('/signup', async (req, res) => {
  const { name, email, password, profile_image_url = '' } = req.body || {};

  if (!name?.trim()) return res.status(400).json({ message: '用户名不能为空' });
  if (!email?.trim()) return res.status(400).json({ message: '邮箱不能为空' });
  if (!password || password.length < 6) return res.status(400).json({ message: '密码长度至少 6 位' });

  const normalizedEmail = email.toLowerCase().trim();
  if (findUserByEmail(normalizedEmail)) {
    return res.status(409).json({ message: '该邮箱已被注册' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = insertUser({
    id: crypto.randomUUID(),
    name: name.trim(),
    email: normalizedEmail,
    password_hash: passwordHash,
    profile_image_url,
    created_at: new Date().toISOString(),
  });

  establishSession(req, res, user);
});

router.post('/signin', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email?.trim()) return res.status(400).json({ message: '邮箱不能为空' });
  if (!password) return res.status(400).json({ message: '密码不能为空' });

  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ message: '账号不存在' });

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) return res.status(401).json({ message: '密码错误' });

  establishSession(req, res, user);
});

router.post('/signout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', requireAuth, (req, res) => {
  const user = findUserById(req.session.userId);
  if (!user) return res.status(401).json({ message: '未登录或登录已过期' });
  res.json(toPublicUser(user));
});

export default router;
