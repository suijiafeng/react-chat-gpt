import request from "./config";
import { WEBUI_API_BASE_URL, WEBUI_BASE_URL } from '../constants';
import { providerRegistry } from './providers';
// 演示/正式模式与 provider 的判断统一收敛在配置中心，这里只负责调用
import { isDemoMode, resolveProviderName } from '../store/llmConfig';

export const queryMemory = (params) => {
  const { content, token } = params;
  if (isDemoMode()) {
    // 本地模式：返回空记忆列表
    return Promise.resolve({ data: { documents: [], metadatas: [], distances: [] }, status: 200, statusText: 'OK' });
  }
  // 后端接口（USE_LOCAL_DATA = false 时生效）
  return request.post(`${WEBUI_API_BASE_URL}/memories/query`, { content, token });
};

export const createNewChat = (params = {}) => {
  if (isDemoMode()) {
    // 本地模式：返回模拟的新建对话响应
    return Promise.resolve({ data: { id: '', title: '新对话' }, status: 200, statusText: 'OK' });
  }
  // 后端接口（USE_LOCAL_DATA = false 时生效）
  const chat = params.chat ?? {
    id: '', title: '新对话', models: ['llama3.1:latest'], params: {}, messages: [], tags: [], timestamp: Date.now(),
  };
  return request.post(`${WEBUI_API_BASE_URL}/chats/new`, { chat });
};

export const generateChatCompletion = async (params, callback, signal) => {
  const provider = providerRegistry.getProvider(resolveProviderName());

  try {
    await provider.complete(params, callback, signal);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('请求被取消');
    } else {
      callback('请求失败，请检查您的网络连接或 API 配置。错误信息: ' + error.message);
      console.error('请求错误：', error);
    }
  }
};

export const generateTitle = (params) => {
  const { model, prompt, chat_id } = params;
  if (isDemoMode()) {
    return Promise.resolve({
      statusText: 'OK',
      data: {
        title: prompt.trim().slice(0, 20) || '新对话',
        chat_id,
        model,
      },
    });
  }
  return request.post(`${WEBUI_BASE_URL}/api/task/title/completions`, { model, prompt, chat_id });
};
