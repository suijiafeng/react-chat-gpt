// 后端会话失效（cookie 过期/被清/服务端已删）但前端 localStorage 仍以为登录着时，
// 统一清掉本地登录态并跳转登录页，避免用户卡在"看似已登录、每步都 401"的死局。
//
// 前端登录态（localStorage 的 auth_session）与后端会话（httpOnly cookie）是两套，
// 前端无从主动感知 cookie 失效，只能在收到 401 时被动纠正这里的状态不一致。

const SESSION_KEY = 'auth_session';

export const handleSessionExpired = () => {
  if (typeof window === 'undefined') return;
  const hadSession = localStorage.getItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('demo_mode');
  // 只有原本以为登录着、且当前不在登录页时才跳转，避免登录页自身 401（密码错误）触发循环
  if (hadSession && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login?expired=1';
  }
};
