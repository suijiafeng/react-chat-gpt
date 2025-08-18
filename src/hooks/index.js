import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getSession, userSignOut } from '../apis/auths';
import { seedDemoUser } from '../store/db';
import { userStore } from '../store';
export * from './useChat';

export const useLanguage = () => {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const savedLanguage = localStorage.getItem('appLanguage');
    if (savedLanguage) {
      i18n.changeLanguage(savedLanguage);
    }
  }, [i18n]);

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

export const loginAsDemo = () => {
  localStorage.setItem('demo_mode', 'true');
  userStore.setUser({ email: 'demo@example.com', name: 'Demo User', profile_image_url: '' });
};

export const logoutDemo = () => {
  localStorage.removeItem('demo_mode');
};

// ──────────────────────────────────────────────
// useAuth：读取本地 session 校验登录状态
// ──────────────────────────────────────────────

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 预置演示账号（首次启动时异步写入，不阻塞登录检测）
    seedDemoUser().catch(() => {});

    // Demo 快捷模式
    if (localStorage.getItem('demo_mode') === 'true') {
      userStore.setUser({ email: 'demo@example.com', name: 'Demo User', profile_image_url: '' });
      setIsLoggedIn(true);
      setIsLoading(false);
      return;
    }

    // 本地 session 校验
    const session = getSession();
    if (session?.id) {
      userStore.setUser(session);
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
    setIsLoading(false);
  }, []);

  return { isLoggedIn, isLoading };
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
