// LLM 运行配置中心：模型服务的唯一数据来源。
//
// 职责：
// 1. 统一读写 localStorage 里的 LLM 相关配置（provider、多服务商 profile、模型等）；
// 2. 提供订阅机制——设置弹窗保存后，模型选择器、聊天界面立即感知，无需刷新页面；
// 3. 收敛"当前该用哪个 provider / 是否演示模式"的判断逻辑，
//    演示代码（demo provider、mock 数据）与正式代码只在这里交汇，其余模块不再各自判断。
//
// 多服务商（profile）模型：
// - llm_profiles 存一组 OpenAI 兼容服务商配置 {id,name,apiUrl,apiKey,models,model}，
//   可同时配置多家（DeepSeek + OpenRouter + Ollama...），聊天页顶部选择器跨服务商切换；
// - llm_active_profile 指向当前生效的一家；
// - 旧版单配置（llm_api_url / llm_api_key / llm_model / llm_models）首次读取时自动迁移。

import { useSyncExternalStore } from 'react';
import { USE_LOCAL_DATA, DEFAULT_LLM_PROVIDER, DEFAULT_LLM_MODEL } from '../constants';
import { PROVIDER_PRESETS } from '../constants/providerPresets';
import { encryptString, decryptString, isEncrypted } from '../utils/keyVault';

const KEYS = {
  provider: 'llm_provider',
  profiles: 'llm_profiles',
  activeProfile: 'llm_active_profile',
  // 旧版单服务商配置键，仅作为迁移来源保留读取
  apiUrl: 'llm_api_url',
  apiKey: 'llm_api_key',
  model: 'llm_model',
  models: 'llm_models',
  contextTokens: 'llm_context_tokens',
  think: 'llm_think',
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

// 旧版 b64 编码的解码（仅用于向加密格式迁移；新数据一律走 keyVault 加密）
const decodeLegacyKey = (stored) => {
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

// ──────────────────────────────────────────────
// API Key 内存缓存
//
// localStorage 里只存 AES-GCM 密文（keyVault），明文只存在于这份内存 Map；
// getConfig() 是同步接口，从这里取值。应用启动时异步解密填充，
// 完成后 notify() 让订阅方拿到真实 key。旧的 b64/明文存量在首次启动时自动迁移加密。
// ──────────────────────────────────────────────

const keyCache = new Map(); // profileId → 明文 key

const initKeyCache = async () => {
  let profiles;
  try {
    profiles = JSON.parse(localStorage.getItem(KEYS.profiles) || '[]');
  } catch {
    return;
  }
  if (!Array.isArray(profiles)) return;

  let needRewrite = false;
  for (const p of profiles) {
    if (!p || !p.id) continue;
    if (isEncrypted(p.apiKey)) {
      keyCache.set(p.id, await decryptString(p.apiKey));
    } else if (p.apiKey) {
      // 旧版 b64 / 明文存量：解出后就地升级为加密格式
      const plain = decodeLegacyKey(p.apiKey);
      keyCache.set(p.id, plain);
      p.apiKey = await encryptString(plain);
      needRewrite = true;
    } else {
      keyCache.set(p.id, '');
    }
  }
  if (needRewrite) {
    localStorage.setItem(KEYS.profiles, JSON.stringify(profiles));
  }
  notify(); // 让已渲染的组件拿到解密后的 key
};

// 浏览器环境下启动即迁移/解密；测试等无 window 环境跳过
if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
  initKeyCache().catch((e) => console.error('API Key 解密初始化失败：', e));
}

const readLegacyModels = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEYS.models) || '[]');
    return Array.isArray(parsed) ? parsed.filter((m) => typeof m === 'string' && m.trim()) : [];
  } catch {
    return [];
  }
};

// 读取 profiles（存储态，apiKey 保持编码），并在首次读取时做旧配置迁移
const readStoredProfiles = () => {
  const raw = localStorage.getItem(KEYS.profiles);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (p) => p && typeof p === 'object' && typeof p.apiUrl === 'string'
        );
      }
    } catch {
      // 数据损坏时按空处理，下面走迁移/空列表逻辑
    }
    return [];
  }

  // llm_profiles 不存在：尝试从旧版单配置迁移
  const legacyUrl = localStorage.getItem(KEYS.apiUrl);
  if (!legacyUrl) return [];
  const preset = PROVIDER_PRESETS.find((p) => p.apiUrl === legacyUrl);
  const legacyModels = readLegacyModels();
  const legacyModel = localStorage.getItem(KEYS.model) || DEFAULT_LLM_MODEL;
  const migrated = [
    {
      id: preset?.id || 'custom-1',
      name: preset?.name || '自定义服务商',
      apiUrl: legacyUrl,
      apiKey: localStorage.getItem(KEYS.apiKey) || '', // 保持原编码格式
      models: legacyModels.length ? legacyModels : [legacyModel],
      model: legacyModel,
    },
  ];
  localStorage.setItem(KEYS.profiles, JSON.stringify(migrated));
  if (!localStorage.getItem(KEYS.activeProfile)) {
    localStorage.setItem(KEYS.activeProfile, migrated[0].id);
  }
  return migrated;
};

export const getConfig = () => {
  if (snapshot) return snapshot;

  const storedProfiles = readStoredProfiles();
  // 暴露给上层时换成内存缓存里的明文 key（加密态只留在 localStorage）。
  // 缓存尚未就绪（启动解密中）时旧 b64 存量可同步解码兜底，加密存量暂为 ''，
  // 解密完成后 notify 会触发重建。
  const profiles = storedProfiles.map((p) => {
    const models = Array.isArray(p.models)
      ? p.models.filter((m) => typeof m === 'string' && m.trim())
      : [];
    // enabledModels：用户勾选"在外部选择器展示"的模型子集，一律手动勾选，
    // 不做任何默认补选；为空则该服务商不在外部列表展示
    const enabledModels = Array.isArray(p.enabledModels)
      ? p.enabledModels.filter((m) => models.includes(m))
      : [];
    return {
      ...p,
      apiKey: keyCache.has(p.id)
        ? keyCache.get(p.id)
        : isEncrypted(p.apiKey)
        ? ''
        : decodeLegacyKey(p.apiKey),
      hasApiKey: Boolean(p.apiKey),
      models,
      enabledModels,
    };
  });

  const storedActiveId = localStorage.getItem(KEYS.activeProfile);
  const active =
    profiles.find((p) => p.id === storedActiveId) || profiles[0] || null;

  const provider = localStorage.getItem(KEYS.provider) || DEFAULT_LLM_PROVIDER;
  const model = active?.model || localStorage.getItem(KEYS.model) || DEFAULT_LLM_MODEL;
  // 顶层 models 镜像 = 激活 profile 的启用子集（外部选择器与模型解析以它为准）；
  // 全部取消勾选时回退为当前模型单项，保证请求与头部展示仍可用
  const activeList = active?.enabledModels;
  const models = activeList?.length ? activeList : [model];

  snapshot = {
    provider,
    profiles,
    activeProfileId: active?.id || '',
    // 以下四个字段镜像当前激活 profile，OpenAIProvider 等旧调用方直接使用
    apiUrl: active?.apiUrl || localStorage.getItem(KEYS.apiUrl) || DEFAULT_API_URL,
    apiKey: active ? active.apiKey : decodeLegacyKey(localStorage.getItem(KEYS.apiKey)),
    model,
    models,
    contextTokens: parseInt(localStorage.getItem(KEYS.contextTokens), 10) || 8000,
    think: localStorage.getItem(KEYS.think) === 'true',
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
  if (partial.model !== undefined) localStorage.setItem(KEYS.model, partial.model.trim());
  if (partial.contextTokens !== undefined) {
    localStorage.setItem(KEYS.contextTokens, String(partial.contextTokens));
  }
  if (partial.think !== undefined) {
    localStorage.setItem(KEYS.think, String(Boolean(partial.think)));
  }
  if (partial.currentModel !== undefined) {
    localStorage.setItem(KEYS.currentModel, partial.currentModel);
  }
  notify();
};

/**
 * 保存多服务商 profile 列表（apiKey 传入明文，这里 AES-GCM 加密后落盘）。
 * 明文同步写入内存缓存（订阅方立即可用），密文异步写 localStorage。
 * @param {Array} profiles - [{id,name,apiUrl,apiKey,models,model}]
 * @param {string} activeId - 当前激活的 profile id
 */
export const saveProfiles = async (profiles, activeId) => {
  const stored = await Promise.all(
    profiles.map(async (p) => {
      const plain = (p.apiKey || '').trim();
      keyCache.set(p.id, plain);
      const models = (p.models || []).map((m) => m.trim()).filter(Boolean);
      return {
        id: p.id,
        name: p.name,
        apiUrl: (p.apiUrl || '').trim(),
        apiKey: plain ? await encryptString(plain) : '',
        models,
        enabledModels: (p.enabledModels || []).filter((m) => models.includes(m)),
        model: (p.model || '').trim(),
      };
    })
  );
  localStorage.setItem(KEYS.profiles, JSON.stringify(stored));
  if (activeId !== undefined) localStorage.setItem(KEYS.activeProfile, activeId);
  notify();
};

/** 切换当前使用的模型（模型选择器调用，demo/backend 模式） */
export const setCurrentModel = (model) => {
  // 用推导结果而不是 localStorage 里存的那个值：存的可能还是历史遗留的 'demo'，
  // 而实际已经有可用服务商，此时必须走 custom 分支把模型写回激活 profile
  const provider = resolveProviderName();
  if (provider === 'custom') {
    // custom 下同步写入激活 profile 的默认模型，OpenAIProvider 请求时读取
    setCurrentSelection(getConfig().activeProfileId, model);
  } else {
    saveConfig({ currentModel: model });
  }
};

/**
 * 跨服务商切换模型：激活指定 profile 并选中其中一个模型。
 * 模型选择器里点击任意服务商分组下的模型时调用。
 */
export const setCurrentSelection = (profileId, model) => {
  const { profiles } = getConfig();
  const target = profiles.find((p) => p.id === profileId);
  if (!target) return;
  localStorage.setItem(KEYS.activeProfile, profileId);
  // 把选中的模型写回该 profile 的默认模型，请求层直接读 getConfig().model
  saveProfiles(
    profiles.map((p) => (p.id === profileId ? { ...p, model } : p)),
    profileId
  );
  saveConfig({ model, currentModel: model });
};

// ──────────────────────────────────────────────
// 模式判断（演示 / 正式的唯一交汇点）
// ──────────────────────────────────────────────

/** 是否处于演示数据模式：构建开关打开，或用演示账号快捷登录 */
export const isDemoMode = () =>
  USE_LOCAL_DATA || localStorage.getItem('demo_mode') === 'true';

/**
 * 解析当前应使用的 provider 名称。
 *
 * demo 是兜底，不是一种可选模式——设置里的「接口服务提供商」tab 移除后，用户不再能
 * 主动"选择演示模式"，所以这里也不能把存下来的 'demo' 当成一次显式选择去尊重：
 * 只要有一个配置可用的模型服务商，就该走真实请求；一个都没有，才回落 demo。
 * 否则用户配好了 key 和模型，却因为历史上存过 provider='demo' 而始终收到预设回复。
 *
 * 优先级：服务器托管（显式保存过）> 有可用服务商则 custom > 兜底 demo。
 */
export const resolveProviderName = () => {
  const stored = localStorage.getItem(KEYS.provider);
  // 服务器托管仍是一次显式配置行为（配置存在服务端账号下），保持尊重
  if (stored === 'backend') return 'backend';

  // "可用"= 填了接口地址且勾选了至少一个启用模型，两者缺一都发不出请求
  const usable = getConfig().profiles.some(
    (p) => p.apiUrl?.trim() && (p.enabledModels?.length || p.model)
  );
  if (usable) return 'custom';

  if (isDemoMode()) return 'demo';
  // 没有可用服务商、也不在演示环境：交给部署方配置的默认值（如自建 Ollama）
  return DEFAULT_LLM_PROVIDER === 'custom' || DEFAULT_LLM_PROVIDER === 'demo'
    ? DEFAULT_LLM_PROVIDER
    : 'ollama';
};

/** 当前生效的模型显示名（模型选择器 / 发请求时用） */
export const resolveCurrentModel = () => {
  const config = getConfig();
  const provider = resolveProviderName();
  if (provider === 'demo') {
    return DEMO_MODELS.includes(config.currentModel) ? config.currentModel : DEMO_MODELS[0];
  }
  if (provider === 'backend') {
    // 服务器托管模式：模型由后端账号配置决定，不走本地 models 列表
    return config.currentModel || config.model;
  }
  // custom：优先当前选中的；不在激活 profile 列表里则回退到该 profile 默认模型
  return config.models.includes(config.currentModel) ? config.currentModel : config.model;
};

// ──────────────────────────────────────────────
// React Hook
// ──────────────────────────────────────────────

/** 订阅式读取 LLM 配置，配置变更时组件自动重渲染 */
export const useLlmConfig = () => useSyncExternalStore(subscribe, getConfig);
