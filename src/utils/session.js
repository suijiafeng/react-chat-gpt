// 后端会话失效（cookie 过期/被清/服务端已删）但前端 localStorage 仍以为登录着时，
// 统一清掉本地登录态并跳转登录页，避免用户卡在"看似已登录、每步都 401"的死局。
//
// 前端登录态（localStorage 的 auth_session）与后端会话（httpOnly cookie）是两套，
// 前端无从主动感知 cookie 失效，只能在收到 401 时被动纠正这里的状态不一致。

const SESSION_KEY = 'auth_session';
const EXPIRED_FLAG = 'session_expired';

export const handleSessionExpired = () => {
  if (typeof window === 'undefined') return;
  const hadSession = localStorage.getItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('demo_mode');
  // 只有原本以为登录着、且当前不在登录页时才跳转，避免登录页自身 401（密码错误）触发循环。
  // 路由是 HashRouter，登录页真实位置是 #/login——判断与跳转都必须走 hash：
  // 早先的 location.href='/login?expired=1' 会离开 SPA 去请求一个服务端并不存在的路径，
  // 只能靠 nginx 回退勉强回到应用，且随后的 replaceState 又会把 hash 抹掉。
  if (hadSession && !window.location.hash.startsWith('#/login')) {
    // 过期提示走 sessionStorage 而非 URL 参数：hash 路由下 location.search 读不到 hash 里的
    // 查询串；标记读完即删，刷新也不会反复弹提示。
    sessionStorage.setItem(EXPIRED_FLAG, '1');
    window.location.replace(`${window.location.pathname}${window.location.search}#/login`);
  }
};

// 读取并清除"会话已过期"标记，保证提示只出现一次
export const consumeExpiredFlag = () => {
  if (typeof window === 'undefined') return false;
  const expired = sessionStorage.getItem(EXPIRED_FLAG) === '1';
  if (expired) sessionStorage.removeItem(EXPIRED_FLAG);
  return expired;
};
