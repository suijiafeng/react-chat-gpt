import axios from 'axios';
import { handleSessionExpired } from './session';

// Create a function that returns an axios instance with custom options
export const createApiInstance = (baseURL, timeout) => {
  const api = axios.create({
    baseURL,
    timeout,
    // 后端用 httpOnly cookie 存 session，必须带上凭据浏览器才会附带/接受这个 cookie；
    // 服务端 CORS 也要求 Access-Control-Allow-Credentials，两边缺一不可
    withCredentials: true,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
  });

  // Response interceptor for global error handling
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response) {
        // 后端返回 401 且不是登录/注册接口本身（那类 401 是密码错误，应留在表单里提示）：
        // 说明会话已失效，清掉本地登录态并跳登录页，纠正前后端登录态不一致
        const url = error.config?.url || '';
        if (error.response.status === 401 && !url.includes('/auths/')) {
          handleSessionExpired();
        }
      } else if (error.request) {
        console.error('Request error:', error.request);
      } else {
        console.error('Error:', error.message);
      }
      return Promise.reject(error);
    }
  );

  return api;
};
