import { describe, it, expect } from 'vitest';
import {
  buildUserContent,
  composeTextWithAttachments,
  contentToText,
  formatFileSize,
} from './attachments';

describe('buildUserContent', () => {
  it('无附件时返回纯字符串（兼容性最好）', () => {
    expect(buildUserContent('你好', [], [])).toBe('你好');
    expect(buildUserContent('你好', undefined, undefined)).toBe('你好');
  });

  it('有图片时返回 OpenAI vision 数组格式', () => {
    const content = buildUserContent('看图', [{ dataUrl: 'data:image/png;base64,AAA' }], []);
    expect(Array.isArray(content)).toBe(true);
    expect(content[0]).toEqual({ type: 'text', text: '看图' });
    expect(content[1]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,AAA' },
    });
  });

  it('文件附件文本被包装进消息文本', () => {
    const atts = [{ name: 'a.txt', textContent: 'FILE BODY', truncated: false }];
    const content = buildUserContent('总结一下', [], atts);
    expect(content).toContain('[附件文件: a.txt]');
    expect(content).toContain('FILE BODY');
    expect(content.endsWith('总结一下')).toBe(true);
  });

  it('截断的附件带截断标记', () => {
    const atts = [{ name: 'big.pdf', textContent: 'x', truncated: true }];
    expect(composeTextWithAttachments('q', atts)).toContain('（内容过长已截断）');
  });
});

describe('contentToText', () => {
  it('字符串原样返回', () => {
    expect(contentToText('hi')).toBe('hi');
  });

  it('vision 数组只提取 text 部分', () => {
    expect(
      contentToText([
        { type: 'text', text: 'hello' },
        { type: 'image_url', image_url: { url: 'data:...' } },
        { type: 'text', text: 'world' },
      ])
    ).toBe('hello\nworld');
  });

  it('异常输入返回空串', () => {
    expect(contentToText(null)).toBe('');
    expect(contentToText(undefined)).toBe('');
    expect(contentToText(42)).toBe('');
  });
});

describe('formatFileSize', () => {
  it('按量级格式化', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(2048)).toBe('2.0 KB');
    expect(formatFileSize(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
