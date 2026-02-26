import request from "./config";
import { WEBUI_API_BASE_URL, USE_LOCAL_DATA } from '../constants';

// 本地演示模式（USE_LOCAL_DATA=true）没有真实后端，返回空列表即可——
// 前端演示 / 自定义 OpenAI 模式的模型列表由 localStorage 维护，不走这个接口。
const LOCAL_MODELS = { data: [] };

// 拉取服务器托管模式下当前账号可用的模型列表。
// 由后端向上游 /models 转发，既能带上加密存储的 Key，又绕开浏览器 CORS。
export const getModels = () => {
  if (USE_LOCAL_DATA) {
    return Promise.resolve({ data: LOCAL_MODELS, status: 200, statusText: 'OK' });
  }
  return request.get(`${WEBUI_API_BASE_URL}/llm/models`);
};
