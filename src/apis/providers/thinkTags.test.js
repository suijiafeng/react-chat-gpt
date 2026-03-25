// <think> 标签流式分流器的单元测试。
// 覆盖：跨 chunk 半截标签、流结束冲刷、尾部字符不丢失（旧实现的回归 bug）、
// 以及 reasoning 字段的跨平台兼容（reasoning_content / reasoning）。
import { describe, it, expect } from 'vitest';
import { createThinkSplitter, deltaReasoning } from './thinkTags';

// 把若干 chunk 依次喂给分流器并 flush，聚合出最终的可见文本与思考文本
const run = (chunks) => {
  const s = createThinkSplitter();
  let visible = '';
  let reasoning = '';
  for (const c of chunks) {
    const o = s.push(c);
    visible += o.visible;
    reasoning += o.reasoning;
  }
  const f = s.flush();
  visible += f.visible;
  reasoning += f.reasoning;
  return { visible, reasoning };
};

describe('createThinkSplitter', () => {
  it('短消息一个字都不丢（旧实现会吃掉末尾 ≤6 字符）', () => {
    expect(run(['你好。'])).toEqual({ visible: '你好。', reasoning: '' });
  });

  it('普通流式文本原样透传', () => {
    expect(run(['今天', '天气', '很好'])).toEqual({ visible: '今天天气很好', reasoning: '' });
  });

  it('单 chunk 内完整标签', () => {
    expect(run(['<think>推理中</think>答案是2'])).toEqual({ visible: '答案是2', reasoning: '推理中' });
  });

  it('开标签被流式切成两半', () => {
    expect(run(['前文<thi', 'nk>秘密思考</think>后文'])).toEqual({
      visible: '前文后文',
      reasoning: '秘密思考',
    });
  });

  it('闭标签被流式切成两半', () => {
    expect(run(['<think>思考A</th', 'ink>可见B'])).toEqual({ visible: '可见B', reasoning: '思考A' });
  });

  it('标签被切成三段以上的极碎流', () => {
    expect(run(['<', 'think', '>abc</', 'think>xyz'])).toEqual({ visible: 'xyz', reasoning: 'abc' });
  });

  it('思考未闭合直到流结束时 flush 归入 reasoning', () => {
    expect(run(['<think>没写完的思考'])).toEqual({ visible: '', reasoning: '没写完的思考' });
  });

  it('正文恰好以疑似半截标签结尾时 flush 归入可见文本', () => {
    expect(run(['价格是 a<b 哦，<thi'])).toEqual({ visible: '价格是 a<b 哦，<thi', reasoning: '' });
  });

  it('多段 think 标签交替', () => {
    expect(run(['<think>一</think>甲<think>二</think>乙'])).toEqual({
      visible: '甲乙',
      reasoning: '一二',
    });
  });
});

describe('deltaReasoning', () => {
  it('识别 DeepSeek/通义/智谱系的 reasoning_content', () => {
    expect(deltaReasoning({ reasoning_content: 'a' })).toBe('a');
  });

  it('识别 Ollama 兼容层的 reasoning', () => {
    expect(deltaReasoning({ reasoning: 'b' })).toBe('b');
  });

  it('无思考字段时返回空串', () => {
    expect(deltaReasoning({ content: 'c' })).toBe('');
    expect(deltaReasoning(undefined)).toBe('');
  });
});
