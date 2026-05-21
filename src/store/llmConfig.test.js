import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// node 环境没有 localStorage，用最小桩顶上；每个用例前重置模块，避免配置快照串味
const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
};

const loadModule = async () => {
  vi.resetModules();
  return import('./llmConfig');
};

const putProfiles = (profiles, activeId) => {
  localStorage.setItem('llm_profiles', JSON.stringify(profiles));
  if (activeId) localStorage.setItem('llm_active_profile', activeId);
};

beforeEach(() => {
  globalThis.localStorage = makeStorage();
});

afterEach(() => {
  delete globalThis.localStorage;
});

describe('resolveProviderName：演示模式只是兜底，不是一种可选模式', () => {
  it('一个服务商都没配 → 回落 demo', async () => {
    const { resolveProviderName } = await loadModule();
    expect(resolveProviderName()).toBe('demo');
  });

  it('有可用服务商时走 custom —— 即使历史上存过 provider=demo', async () => {
    localStorage.setItem('llm_provider', 'demo'); // 旧版本"显式选了演示模式"的遗留值
    putProfiles(
      [
        {
          id: 'deepseek',
          name: 'DeepSeek',
          apiUrl: 'https://api.deepseek.com/v1',
          apiKey: '',
          models: ['deepseek-chat'],
          enabledModels: ['deepseek-chat'],
          model: 'deepseek-chat',
        },
      ],
      'deepseek'
    );
    const { resolveProviderName } = await loadModule();
    // 配好了却仍收到预设回复，是这次改动要修掉的行为
    expect(resolveProviderName()).toBe('custom');
  });

  it('只填了地址、一个模型都没勾 → 发不出请求，仍然兜底 demo', async () => {
    putProfiles([
      {
        id: 'custom-1',
        name: '自定义',
        apiUrl: 'https://api.example.com/v1',
        apiKey: '',
        models: [],
        enabledModels: [],
        model: '',
      },
    ]);
    const { resolveProviderName } = await loadModule();
    expect(resolveProviderName()).toBe('demo');
  });

  it('服务器托管是显式配置行为，保持尊重', async () => {
    localStorage.setItem('llm_provider', 'backend');
    const { resolveProviderName } = await loadModule();
    expect(resolveProviderName()).toBe('backend');
  });
});
