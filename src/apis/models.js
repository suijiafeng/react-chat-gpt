import request from "./config";
import { WEBUI_BASE_URL, USE_LOCAL_DATA } from '../constants';

// ── 本地 Mock 模型列表（后端就绪后可删除此段）──────────────
const LOCAL_MODELS = {
  data: [
    { id: 'llama3.1:latest',  name: 'Llama 3.1',    object: 'model' },
    { id: 'gemma2:9b',        name: 'Gemma 2 9B',   object: 'model' },
    { id: 'qwen2.5:7b',       name: 'Qwen 2.5 7B',  object: 'model' },
    { id: 'deepseek-r1:7b',   name: 'DeepSeek R1',  object: 'model' },
  ],
};
// ──────────────────────────────────────────────────────────

export const getModels = () => {
  if (USE_LOCAL_DATA) {
    return Promise.resolve({ data: LOCAL_MODELS, status: 200, statusText: 'OK' });
  }
  // 后端接口（USE_LOCAL_DATA = false 时生效）
  return request.get(`${WEBUI_BASE_URL}/api/models`);
};
