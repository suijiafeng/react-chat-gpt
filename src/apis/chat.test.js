import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock 配置中心与 provider 注册表，隔离测试 generateTitle 的组装/兜底逻辑
vi.mock('../store/llmConfig', () => ({
  isDemoMode: vi.fn(),
  resolveProviderName: vi.fn(() => 'custom'),
}));

const completeMock = vi.fn();
vi.mock('./providers', () => ({
  providerRegistry: {
    getProvider: vi.fn(() => ({ complete: completeMock })),
  },
}));

import { generateTitle } from './chat';
import { isDemoMode } from '../store/llmConfig';

describe('generateTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('演示模式：直接截断用户消息前 20 字', async () => {
    isDemoMode.mockReturnValue(true);
    const res = await generateTitle({ model: 'demo', prompt: '  一二三四五六七八九十一二三四五六七八九十超出部分 ', chat_id: 'c1' });
    expect(res.data.title).toBe('一二三四五六七八九十一二三四五六七八九十');
    expect(res.data.chat_id).toBe('c1');
    expect(completeMock).not.toHaveBeenCalled();
  });

  it('正式模式：拼接流式 chunk 并剥离首尾引号', async () => {
    isDemoMode.mockReturnValue(false);
    completeMock.mockImplementation(async (_params, callback) => {
      callback('「周末', undefined);
      callback('旅行计划」', undefined);
      callback('[DONE]');
    });
    const res = await generateTitle({ model: 'gpt', prompt: '帮我做周末旅行计划', chat_id: 'c2' });
    expect(res.data.title).toBe('周末旅行计划');
  });

  it('思考流 chunk 不计入标题', async () => {
    isDemoMode.mockReturnValue(false);
    completeMock.mockImplementation(async (_params, callback) => {
      callback('让我想想…', { isReasoning: true });
      callback('标题正文');
      callback('[DONE]');
    });
    const res = await generateTitle({ model: 'gpt', prompt: 'x', chat_id: 'c3' });
    expect(res.data.title).toBe('标题正文');
  });

  it('provider 抛错时回退截断兜底', async () => {
    isDemoMode.mockReturnValue(false);
    completeMock.mockRejectedValue(new Error('network down'));
    const res = await generateTitle({ model: 'gpt', prompt: '兜底标题内容', chat_id: 'c4' });
    expect(res.data.title).toBe('兜底标题内容');
    expect(res.statusText).toBe('OK');
  });

  it('收到 isError chunk 时回退兜底而不是把错误文案当标题', async () => {
    isDemoMode.mockReturnValue(false);
    completeMock.mockImplementation(async (_params, callback) => {
      callback('上游返回错误：quota', { isError: true });
      callback('[DONE]');
    });
    const res = await generateTitle({ model: 'gpt', prompt: '正常问题', chat_id: 'c5' });
    expect(res.data.title).toBe('正常问题');
  });

  it('模型输出为空时回退兜底', async () => {
    isDemoMode.mockReturnValue(false);
    completeMock.mockImplementation(async (_params, callback) => {
      callback('[DONE]');
    });
    const res = await generateTitle({ model: 'gpt', prompt: '  ', chat_id: 'c6' });
    expect(res.data.title).toBe('新对话');
  });
});
