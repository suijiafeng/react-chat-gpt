
// ──────────────────────────────────────────────
// 数据来源开关：支持通过环境变量配置，默认为 true
// true = 本地 Mock / IndexedDB，false = 真实后端接口
// ──────────────────────────────────────────────
export const USE_LOCAL_DATA = import.meta.env.VITE_USE_LOCAL_DATA !== undefined
  ? import.meta.env.VITE_USE_LOCAL_DATA === 'true'
  : true;

// 使用 window 对象来检测是否在浏览器环境中
const isBrowser = typeof window !== 'undefined';

// 假设开发环境使用特定的主机名或端口，你可以根据实际情况调整这个逻辑
const isDev = isBrowser && (window.location.hostname === 'localhost' || window.location.port === '3000');

export const APP_NAME = import.meta.env.VITE_APP_NAME || 'AI Chat';

export const WEBUI_BASE_URL = import.meta.env.VITE_WEBUI_BASE_URL !== undefined
  ? import.meta.env.VITE_WEBUI_BASE_URL
  : (isBrowser && isDev ? `http://${window.location.hostname}:3000` : '');

export const WEBUI_API_BASE_URL = `${WEBUI_BASE_URL}/api/v1`;

export const OLLAMA_API_BASE_URL = `${WEBUI_BASE_URL}/ollama`;

// 默认的 LLM provider / model：部署时可通过环境变量覆盖，
// 用户在设置弹窗里保存过的选择始终优先于这两个默认值
export const DEFAULT_LLM_PROVIDER = import.meta.env.VITE_DEFAULT_LLM_PROVIDER || 'demo';
export const DEFAULT_LLM_MODEL = import.meta.env.VITE_DEFAULT_LLM_MODEL || 'gpt-4o-mini';
