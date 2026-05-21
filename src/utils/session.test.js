import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handleSessionExpired, consumeExpiredFlag } from './session';

// 极简 Storage 桩：node 环境没有 localStorage/sessionStorage
const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
};

const setupWindow = (hash) => {
  const replaced = [];
  globalThis.window = {
    location: {
      pathname: '/',
      search: '',
      hash,
      replace: (url) => replaced.push(url),
    },
  };
  globalThis.localStorage = makeStorage();
  globalThis.sessionStorage = makeStorage();
  return replaced;
};

afterEach(() => {
  delete globalThis.window;
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
});

describe('handleSessionExpired', () => {
  beforeEach(() => {});

  it('清掉本地登录态并跳到 hash 路由的登录页', () => {
    const replaced = setupWindow('#/c/abc');
    localStorage.setItem('auth_session', '{"id":"1"}');
    localStorage.setItem('demo_mode', 'true');

    handleSessionExpired();

    expect(localStorage.getItem('auth_session')).toBeNull();
    expect(localStorage.getItem('demo_mode')).toBeNull();
    // 必须是 #/login，跳到服务端并不存在的 /login 会整个离开 SPA
    expect(replaced).toEqual(['/#/login']);
    expect(consumeExpiredFlag()).toBe(true);
    // 标记读完即删，刷新不再重复提示
    expect(consumeExpiredFlag()).toBe(false);
  });

  it('已经在登录页时不再跳转（避免密码错误的 401 触发循环）', () => {
    const replaced = setupWindow('#/login');
    localStorage.setItem('auth_session', '{"id":"1"}');

    handleSessionExpired();

    expect(replaced).toEqual([]);
  });

  it('本来就没有登录态时不跳转', () => {
    const replaced = setupWindow('#/c/abc');

    handleSessionExpired();

    expect(replaced).toEqual([]);
    expect(consumeExpiredFlag()).toBe(false);
  });
});
