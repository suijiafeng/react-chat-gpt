// LLM 运行配置中心：模型服务的唯一数据来源。
//
// 职责：
// 1. 统一读写 localStorage 里的 LLM 相关配置（provider、地址、密钥、模型列表等）；
// 2. 提供订阅机制——设置弹窗保存后，模型选择器、聊天界面立即感知，无需刷新页面；
// 3. 收敛"当前该用哪个 provider / 是否演示模式"的判断逻辑，
//    演示代码（demo provider、mock 数据）与正式代码只在这里交汇，其余模块不再各自判断。

import { useSyncExternalStore } from 'react';
import { USE_LOCAL_DATA, DEFAULT_LLM_PROVIDER, DEFAULT_LLM_MODEL } from '../constants';

const KEYS = {
  provider: 'llm_provider',
  apiUrl: 'llm_api_url',
  apiKey: 'llm_api_key',
  model: 'llm_model',
  models: 'llm_models', // JSON 数组：用户维护的可选模型列表
  contextTokens: 'llm_context_tokens',
  currentModel: 'currentModel',
};

const DEFAULT_API_URL = 'https://api.openai.com/v1';
export const DEMO_MODELS = ['demo-assistant'];

// ──────────────────────────────────────────────
// 订阅机制
// ──────────────────────────────────────────────

const listeners = new Set();
// 配置快照缓存：useSyncExternalStore 要求 getSnapshot 在数据未变时返回同一引用
let snapshot = null;

const notify = () => {
  snapshot = null; // 使缓存失效，下次读取时重建
  listeners.forEach((fn) => fn());
};

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// ──────────────────────────────────────────────
// 读取
// ──────────────────────────────────────────────

// API Key 以 b64: 前缀做简单编码存储。
// 注意：这只是避免明文裸露在 localStorage 里被一眼看到，不是加密——
// 纯前端应用没有安全存放密钥的地方，生产环境应通过后端代理转发请求。
const decodeKey = (stored) => {
  if (!stored) return '';
  if (stored.startsWith('b64:')) {
    try {
      return atob(stored.slice(4));
    } catch {
      return stored;
    }
  }
  return stored;
};

const readModels = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEYS.models) || '[]');
    return Array.isArray(parsed) ? parsed.filter((m) => typeof m === 'string' && m.trim()) : [];
  } catch {
    return [];
  }
};

export const getConfig = () => {
  if (snapshot) return snapshot;
  const provider = localStorage.getItem(KEYS.provider) || DEFAULT_LLM_PROVIDER;
  const models = readModels();
  const model = localStorage.getItem(KEYS.model) || DEFAULT_LLM_MODEL;
  snapshot = {
    provider,
    apiUrl: localStorage.getItem(KEYS.apiUrl) || DEFAULT_API_URL,
    apiKey: decodeKey(localStorage.getItem(KEYS.apiKey)),
    model,
    models: models.length ? models : [model],
    contextTokens: parseInt(localStorage.getItem(KEYS.contextTokens), 10) || 8000,
    currentModel: localStorage.getItem(KEYS.currentModel) || '',
  };
  return snapshot;
};

// ──────────────────────────────────────────────
// 写入
// ──────────────────────────────────────────────

/** 保存配置（可部分更新），并通知所有订阅者 */
export const saveConfig = (partial) => {
  if (partial.provider !== undefined) localStorage.setItem(KEYS.provider, partial.provider);
  if (partial.apiUrl !== undefined) localStorage.setItem(KEYS.apiUrl, partial.apiUrl.trim());
  if (partial.apiKey !== undefined) {
    const key = partial.apiKey.trim();
    localStorage.setItem(KEYS.apiKey, key ? 'b64:' + btoa(key) : '');
  }
  if (partial.model !== undefined) localStorage.setItem(KEYS.model, partial.model.trim());
  if (partial.models !== undefined) {
    localStorage.setItem(KEYS.models, JSON.stringify(partial.models.filter((m) => m.trim())));
  }
  if (partial.contextTokens !== undefined) {
    localStorage.setItem(KEYS.contextTokens, String(partial.contextTokens));
  }
  if (partial.currentModel !== undefined) {
    localStorage.setItem(KEYS.currentModel, partial.currentModel);
  }
  notify();
};

/** 切换当前使用的模型（模型选择器调用） */
export const setCurrentModel = (model) => {
  const { provider } = getConfig();
  if (provider === 'custom') {
    // custom 下 llm_model 是 OpenAIProvider 实际请求时读取的字段，两处同步写
    saveConfig({ model, currentModel: model });
  } else {
    saveConfig({ currentModel: model });
  }
};

// ──────────────────────────────────────────────
// 模式判断（演示 / 正式的唯一交汇点）
// ──────────────────────────────────────────────

/** 是否处于演示数据模式：构建开关打开，或用演示账号快捷登录 */
export const isDemoMode = () =>
  USE_LOCAL_DATA || localStorage.getItem('demo_mode') === 'true';

/**
 * 解析当前应使用的 provider 名称。
 * 优先级：用户在设置里显式保存过的选择 > 演示模式默认 demo > 部署配置的默认值
 */
export const resolveProviderName = () => {
  const stored = localStorage.getItem(KEYS.provider);
  if (stored === 'custom' || stored === 'demo') {
    // 显式选择过，原样尊重（即使切换到了真实后端部署，'演示模式'也应继续返回 mock 回复）
    return stored;
  }
  if (isDemoMode()) return 'demo';
  return DEFAULT_LLM_PROVIDER === 'custom' || DEFAULT_LLM_PROVIDER === 'demo'
    ? DEFAULT_LLM_PROVIDER
    : 'ollama';
};

/** 当前生效的模型显示名（模型选择器 / 发请求时用） */
export const resolveCurrentModel = () => {
  const config = getConfig();
  if (resolveProviderName() === 'demo') {
    return DEMO_MODELS.includes(config.currentModel) ? config.currentModel : DEMO_MODELS[0];
  }
  // custom：优先当前选中的；不在列表里则回退到默认模型
  return config.models.includes(config.currentModel) ? config.currentModel : config.model;
};

// ──────────────────────────────────────────────
// React Hook
// ──────────────────────────────────────────────

/** 订阅式读取 LLM 配置，配置变更时组件自动重渲染 */
export const useLlmConfig = () => useSyncExternalStore(subscribe, getConfig);
