import { describe, it, expect, vi } from 'vitest';

// useChat.js 顶层会引入 antd / db 等浏览器依赖，测试纯函数时全部 mock 掉
vi.mock('antd', () => ({ message: { warning: vi.fn(), error: vi.fn() } }));
vi.mock('../apis/chat', () => ({ generateChatCompletion: vi.fn(), generateTitle: vi.fn() }));
vi.mock('../store/db', () => ({
  saveMessageToDB: vi.fn(),
  loadMessagesBySessionPaged: vi.fn(),
  updateSessionTitle: vi.fn(),
  touchSession: vi.fn(),
  deleteMessageFromDB: vi.fn(),
  deleteMessagesByIds: vi.fn(),
}));
vi.mock('../store/llmConfig', () => ({ getConfig: vi.fn(() => ({})) }));
vi.mock('../utils/context', () => ({ trimConversation: vi.fn((m) => m) }));
vi.mock('../utils/attachments', () => ({ buildUserContent: vi.fn((t) => t) }));

import { withSystemPrompt } from './useChat';

describe('withSystemPrompt', () => {
  const conversation = [{ role: 'user', content: 'hi' }];

  it('非空时前置一条 system 消息', () => {
    expect(withSystemPrompt(conversation, '你是翻译')).toEqual([
      { role: 'system', content: '你是翻译' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('空/空白时原样返回', () => {
    expect(withSystemPrompt(conversation, '')).toBe(conversation);
    expect(withSystemPrompt(conversation, '   ')).toBe(conversation);
    expect(withSystemPrompt(conversation, undefined)).toBe(conversation);
  });

  it('首尾空白被裁剪', () => {
    expect(withSystemPrompt(conversation, '  提示词  ')[0].content).toBe('提示词');
  });
});
