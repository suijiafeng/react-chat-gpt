import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getSession } from '../apis/auths';
import { seedDemoUser } from '../store/db';
import { userStore } from '../store';
import { isDemoMode } from '../store/llmConfig';
import { handleSessionExpired } from '../utils/session';
import { WEBUI_API_BASE_URL } from '../constants';
import request from '../apis/config';
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

    // 主动校验后端会话是否仍有效，纠正"localStorage 还在、cookie 已失效"的假登录。
    // 三重守卫缺一不可：
    //  - !isDemoMode()：演示构建(USE_LOCAL_DATA)没有后端；快捷演示登录(demo_mode)没有
    //    后端会话，探测必 401 会把演示用户误踢下线——这两种情况都不发请求，演示模式零影响
    //  - getSession()?.id：本地本来就没登录态时无需校验（未登录本就会被路由挡去登录页）
    // 401 之外的错误（网络抖动、服务暂不可用）不动登录态，避免误伤。
    if (!isDemoMode() && getSession()?.id) {
      request.get(`${WEBUI_API_BASE_URL}/auths/me`).catch((error) => {
        if (error.response?.status === 401) handleSessionExpired();
      });
    }
  }, []);

  return { isLoggedIn };
};
