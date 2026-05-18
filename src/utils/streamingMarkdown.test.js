import { describe, it, expect } from 'vitest';
import { splitStableMarkdown } from './streamingMarkdown';

const T = '尾部'.repeat(40); // 足够长的尾部，保证边界不因 MIN_TAIL 被拒

describe('splitStableMarkdown', () => {
  it('空内容与无空行内容不切分', () => {
    expect(splitStableMarkdown('')).toEqual({ stable: '', tail: '' });
    const noBlank = '一段没有空行的长文字'.repeat(20);
    expect(splitStableMarkdown(noBlank)).toEqual({ stable: '', tail: noBlank });
  });

  it('在空行边界切分，拼接后与原文一致', () => {
    const content = `第一段完整内容。\n\n第二段完整内容。\n\n${T}`;
    const { stable, tail } = splitStableMarkdown(content);
    expect(stable + tail).toBe(content);
    expect(stable).toBe('第一段完整内容。\n\n第二段完整内容。\n\n');
    expect(tail).toBe(T);
  });

  it('不在未闭合代码块内切分', () => {
    const content = '前文。\n\n```js\nconst a = 1;\n\nconst b = 2;\n' + T;
    const { stable } = splitStableMarkdown(content);
    // 代码块内的空行不是安全边界，只能切在 ``` 之前的那个空行
    expect(stable).toBe('前文。\n\n');
  });

  it('闭合后的代码块可以整体进入稳定前缀', () => {
    const content = '前文。\n\n```js\nconst a = 1;\n```\n\n' + T;
    const { stable, tail } = splitStableMarkdown(content);
    expect(stable).toBe('前文。\n\n```js\nconst a = 1;\n```\n\n');
    expect(tail).toBe(T);
  });

  it('~~~ 栅栏与 ``` 不互相闭合', () => {
    const content = '前文。\n\n~~~\ncode\n```\n\nstill code\n' + T;
    const { stable } = splitStableMarkdown(content);
    expect(stable).toBe('前文。\n\n'); // ``` 不能闭合 ~~~，仍在代码块内
  });

  it('不在未闭合 $$ 公式块内切分', () => {
    const content = '前文。\n\n$$\na = b\n\nc = d\n' + T;
    const { stable } = splitStableMarkdown(content);
    expect(stable).toBe('前文。\n\n');
  });

  it('边界离末尾太近时不切（避免尾部抖动）', () => {
    const content = '第一段。\n\n短尾';
    expect(splitStableMarkdown(content).stable).toBe('');
  });

  it('最后一个边界太近时回退到更早的边界，而不是放弃切分', () => {
    const content = `第一段完整内容。\n\n${T}\n\n短列表尾`;
    const { stable, tail } = splitStableMarkdown(content);
    // 最后的空行距末尾 <MIN_TAIL，应回退切在第一段之后
    expect(stable).toBe('第一段完整内容。\n\n');
    expect(stable + tail).toBe(content);
  });

  it('多次增量调用下 stable 单调不回退', () => {
    let content = '第一段。\n\n第二段。\n\n';
    const s1 = splitStableMarkdown(content + T).stable;
    content += T + '\n\n';
    const s2 = splitStableMarkdown(content + T).stable;
    expect(s2.startsWith(s1)).toBe(true);
  });
});
