// "服务器托管"模式专用：把 LLM 接入配置存到后端账号下，而不是浏览器 localStorage。
// 依赖用户已登录（session cookie），未登录时后端会返回 401。
import request from './config';
import { WEBUI_API_BASE_URL } from '../constants';

export const getBackendLlmConfig = () => request.get(`${WEBUI_API_BASE_URL}/llm/config`);

// provider 区分上游接口类型：'custom'=OpenAI 兼容层，'ollama'=Ollama 原生 /api/chat。
export const saveBackendLlmConfig = ({ apiUrl, apiKey, model, provider = 'custom' }) =>
  request.put(`${WEBUI_API_BASE_URL}/llm/config`, { provider, apiUrl, apiKey, model });

// 设置页"测试连接"：让后端用表单里的临时地址/密钥去拉上游模型列表，
// 未填 apiKey 时后端回退到已保存的加密 Key。返回 { data: [{ id }] }。
export const testBackendLlmConfig = ({ apiUrl, apiKey }) =>
  request.get(`${WEBUI_API_BASE_URL}/llm/models`, { params: { apiUrl, apiKey } });
