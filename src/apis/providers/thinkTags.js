// <think>...</think> 标签的流式分流器。
//
// 部分平台/部署（Ollama 兼容层、各类 DeepSeek-R1 蒸馏托管）不会用独立的
// reasoning 字段，而是把思维链直接内联在 content 里的 <think> 标签中，
// 且标签可能被流式切块劈成两半（如上个 chunk 结尾 "<thi"、下个开头 "nk>"）。
//
// createThinkSplitter() 返回 { push, flush }：
//   push(text) → { visible, reasoning }  增量分流，跨 chunk 正确处理半截标签
//   flush()    → { visible, reasoning }  流结束时冲刷缓冲，避免尾部字符丢失
//
// 与旧的"仅剥离"实现相比修复了两个问题：
// 1. 思考内容不再被丢弃，而是作为 reasoning 交给调用方（think 开时可展示）；
// 2. 旧实现无条件缓冲末尾 7 字符且流结束不冲刷，导致 think 关闭时每条消息
//    结尾最多 6 个字符被吃掉（短消息甚至整条消失）。现在只在末尾确实可能是
//    半截标签（是 <think> / </think> 的前缀）时才缓冲，并提供 flush。

const OPEN = '<think>';
const CLOSE = '</think>';

// s 的末尾有多长的后缀可能是 token 的前缀（即半截标签），返回该长度
const partialTagLen = (s, token) => {
  const max = Math.min(token.length - 1, s.length);
  for (let k = max; k > 0; k--) {
    if (token.startsWith(s.slice(s.length - k))) return k;
  }
  return 0;
};

export const createThinkSplitter = () => {
  let inTag = false;
  let pending = ''; // 末尾疑似半截标签的缓冲，下个 chunk 到达时拼回重扫

  const push = (input) => {
    const source = pending + (input || '');
    pending = '';
    let visible = '';
    let reasoning = '';
    let i = 0;

    while (i < source.length) {
      if (inTag) {
        const end = source.indexOf(CLOSE, i);
        if (end === -1) {
          const keep = partialTagLen(source.slice(i), CLOSE);
          reasoning += source.slice(i, source.length - keep);
          pending = source.slice(source.length - keep);
          return { visible, reasoning };
        }
        reasoning += source.slice(i, end);
        i = end + CLOSE.length;
        inTag = false;
        continue;
      }

      const start = source.indexOf(OPEN, i);
      if (start === -1) {
        const keep = partialTagLen(source.slice(i), OPEN);
        visible += source.slice(i, source.length - keep);
        pending = source.slice(source.length - keep);
        return { visible, reasoning };
      }
      visible += source.slice(i, start);
      i = start + OPEN.length;
      inTag = true;
    }
    return { visible, reasoning };
  };

  // 流结束：缓冲里剩下的不是标签（标签永远等到闭合或下个 chunk），按当前状态归位
  const flush = () => {
    const rest = pending;
    pending = '';
    if (!rest) return { visible: '', reasoning: '' };
    return inTag ? { visible: '', reasoning: rest } : { visible: rest, reasoning: '' };
  };

  return { push, flush };
};

// 从 OpenAI 兼容 SSE 的 delta 里取思考增量：不同平台字段名不同——
// DeepSeek / 通义 / 智谱 / Moonshot 用 reasoning_content，Ollama 兼容层等用 reasoning
export const deltaReasoning = (delta) => delta?.reasoning_content ?? delta?.reasoning ?? '';
