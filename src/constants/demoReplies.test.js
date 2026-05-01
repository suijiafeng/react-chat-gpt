import { describe, it, expect } from 'vitest';
import { matchTopic, buildDemoReply } from './demoReplies';

describe('matchTopic 关键词加权匹配', () => {
  it('无任何命中返回 null', () => {
    expect(matchTopic('今天天气不错')).toBeNull();
    expect(matchTopic('')).toBeNull();
  });

  it('单主题命中直接返回该主题', () => {
    const best = matchTopic('有没有使用教程');
    expect(best).not.toBeNull();
    expect(best.topic.keywords).toContain('教程');
  });

  it('多主题命中时选综合得分最高的（命中面广者胜）', () => {
    // 「markdown」「表格」「渲染」命中 markdown 主题 3 词，
    // 「教程」只命中使用教程主题 1 词 → 应选 markdown 主题
    const best = matchTopic('给我一份 markdown 表格渲染的教程');
    expect(best.topic.keywords).toContain('markdown');
  });

  it('长关键词比短关键词权重更高', () => {
    // 「提问技巧」（4 字）应把句子归入提示词主题，
    // 即便同时命中了打招呼主题的「你好」（2 字）
    const best = matchTopic('你好，请教一下提问技巧和提示词');
    expect(best.topic.keywords).toContain('提示词');
  });

  it('大小写不敏感', () => {
    expect(matchTopic('HELLO THERE')).not.toBeNull();
    expect(matchTopic('用 MARKDOWN 演示').topic.keywords).toContain('markdown');
  });
});

describe('buildDemoReply', () => {
  it('命中主题时返回该主题的回复之一', () => {
    const reply = buildDemoReply([{ role: 'user', content: '用表格演示一下 markdown' }]);
    expect(reply).toContain('Markdown');
  });

  it('vision 数组 content 也能参与匹配（不崩溃）', () => {
    const reply = buildDemoReply([
      {
        role: 'user',
        content: [
          { type: 'text', text: '你好' },
          { type: 'image_url', image_url: { url: 'data:image/png;base64,x' } },
        ],
      },
    ]);
    expect(typeof reply).toBe('string');
    expect(reply.length).toBeGreaterThan(0);
  });

  it('完全未命中时返回兜底回复', () => {
    const reply = buildDemoReply([{ role: 'user', content: '呜啦啦呜啦啦' }]);
    expect(typeof reply).toBe('string');
    expect(reply.length).toBeGreaterThan(0);
  });
});
