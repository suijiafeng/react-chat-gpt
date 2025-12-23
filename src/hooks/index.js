import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getSession, userSignOut } from '../apis/auths';
import { seedDemoUser } from '../store/db';
import { userStore } from '../store';
export * from './useChat';

export const useLanguage = () => {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    localStorage.setItem('appLanguage', lng);
  };

  return {
    t,
    language: i18n.language,
    changeLanguage,
  };
};

// ──────────────────────────────────────────────
// Demo 快捷登录（保留兼容性）
// ──────────────────────────────────────────────

export const logoutDemo = () => {
  localStorage.removeItem('demo_mode');
};

// ──────────────────────────────────────────────
// useAuth：读取本地 session 校验登录状态
// ──────────────────────────────────────────────

// 登录校验只是同步读 localStorage，因此在 useState 初始化器里一次算完。
// 之前放在 effect 里异步设置，首帧必定先渲染全屏加载动画、下一帧才换成页面，
// 刷新时正文文字（如欢迎语）会"跳"出来。
const resolveAuthState = () => {
  // Demo 快捷模式
  if (localStorage.getItem('demo_mode') === 'true') {
    userStore.setUser({ email: 'demo@example.com', name: 'Demo User', profile_image_url: '' });
    return true;
  }
  // 本地 session 校验
  const session = getSession();
  if (session?.id) {
    userStore.setUser(session);
    return true;
  }
  return false;
};

export const useAuth = () => {
  const [isLoggedIn] = useState(resolveAuthState);

  useEffect(() => {
    // 预置演示账号（首次启动时异步写入，不阻塞登录检测）
    seedDemoUser().catch(() => {});
  }, []);

  // isLoading 恒为 false：校验是同步的，保留字段只为兼容现有调用方
  return { isLoggedIn, isLoading: false };
};

// ──────────────────────────────────────────────
// useLogout
// ──────────────────────────────────────────────

export const useLogout = () => {
  return () => {
    userSignOut();
    userStore.clearUser();
  };
};
