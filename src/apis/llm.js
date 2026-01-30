// "服务器托管"模式专用：把 LLM 接入配置存到后端账号下，而不是浏览器 localStorage。
// 依赖用户已登录（session cookie），未登录时后端会返回 401。
import request from './config';
import { WEBUI_API_BASE_URL } from '../constants';

export const getBackendLlmConfig = () => request.get(`${WEBUI_API_BASE_URL}/llm/config`);

export const saveBackendLlmConfig = ({ apiUrl, apiKey, model }) =>
  request.put(`${WEBUI_API_BASE_URL}/llm/config`, { provider: 'custom', apiUrl, apiKey, model });
