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

// 部分平台提供了能真正控制模型是否思考的请求参数（而不仅是展示层过滤），
// 但字段名/结构各不相同，按 apiUrl 特征匹配拼出对应字段。
// 匹配不到的平台（OpenAI 官方、DeepSeek、Moonshot、Groq、硅基流动、xAI、OpenRouter 等）
// 不携带任何思考相关参数——这些平台没有统一/公开的开关参数，
// 且部分对未知字段严格校验会直接 400，不能无脑携带，只能停留在展示层过滤（见上方注释）。
export const buildProviderThinkParams = (apiUrl, thinkEnabled) => {
  if (/api\.anthropic\.com/.test(apiUrl)) {
    // Anthropic：完整开关，关闭时不能带 budget_tokens
    return thinkEnabled
      ? { thinking: { type: 'enabled', budget_tokens: 4096 } }
      : { thinking: { type: 'disabled' } };
  }
  if (/generativelanguage\.googleapis\.com/.test(apiUrl)) {
    // Gemini OpenAI 兼容层：reasoning_effort='none' 关闭思考（2.5 pro 不支持完全关闭，会被平台忽略）
    return { reasoning_effort: thinkEnabled ? 'medium' : 'none' };
  }
  if (/dashscope\.aliyuncs\.com/.test(apiUrl)) {
    // 通义千问（Qwen3 系）：enable_thinking 布尔开关
    return { enable_thinking: thinkEnabled };
  }
  if (/open\.bigmodel\.cn/.test(apiUrl)) {
    // 智谱 GLM：结构同 Anthropic 但无需 budget_tokens
    return { thinking: { type: thinkEnabled ? 'enabled' : 'disabled' } };
  }
  return {};
};

// OpenAI 兼容 SSE 流的统一适配器：把各平台 delta 的差异
// （reasoning_content / reasoning 字段、内联 <think> 标签、流中错误对象）
// 吸收成 { content, meta } 块。OpenAIProvider 与 BackendProvider 共用。
export const createSseThinkAdapter = (callback, thinkEnabled) => {
  const splitter = createThinkSplitter();

  // 流结束时冲刷分流器缓冲，避免尾部字符丢失
  const wrappedCallback = (content, meta) => {
    if (content === '[DONE]') {
      const rest = splitter.flush();
      if (rest.visible) callback(rest.visible);
      if (rest.reasoning && thinkEnabled) callback(rest.reasoning, { isReasoning: true });
    }
    callback(content, meta);
  };

  const dataParser = (parsed) => {
    // 流中错误对象（OpenAI 系平台在流中报错的标准形态是 data: {"error":{...}}，
    // 自建代理上游中断时也会发同形态的错误块）——标记为错误交给 UI 红色气泡展示
    if (parsed.error) {
      const msg = parsed.error.message || JSON.stringify(parsed.error).slice(0, 200);
      return { content: `上游返回错误：${msg}`, meta: { isError: true } };
    }

    const delta = parsed.choices?.[0]?.delta;
    const chunks = [];

    // 独立思考字段：think 关闭时丢弃不展示（这类平台的思考生成不受请求参数控制，
    // 只能在展示层过滤）
    const reasoning = deltaReasoning(delta);
    if (reasoning && thinkEnabled) {
      chunks.push({ content: reasoning, meta: { isReasoning: true } });
    }

    // 可见文本：内联 <think> 标签拆出的思考部分按 think 开关决定展示或丢弃
    if (delta?.content) {
      const { visible, reasoning: tagReasoning } = splitter.push(delta.content);
      if (tagReasoning && thinkEnabled) {
        chunks.push({ content: tagReasoning, meta: { isReasoning: true } });
      }
      if (visible) chunks.push({ content: visible });
    }

    // 风控/合规掐断：平台侧敏感内容拦截的标准形态是 finish_reason=content_filter，
    // 给出优雅的降级提示，而不是让回复无声地戛然而止
    const finishReason = parsed.choices?.[0]?.finish_reason;
    if (finishReason === 'content_filter') {
      chunks.push({
        content: '本次回复因触发平台内容安全策略被中止，请调整提问后重试。',
        meta: { isError: true },
      });
    }

    return chunks.length ? chunks : null;
  };

  return { wrappedCallback, dataParser };
};
