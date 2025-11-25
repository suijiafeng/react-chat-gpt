import request from "./config";
import { WEBUI_BASE_URL, USE_LOCAL_DATA } from '../constants';

// ── 本地 Mock 模型列表（后端就绪后可删除此段）──────────────
const LOCAL_MODELS = {
  data: [
   
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
