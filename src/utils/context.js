// 上下文窗口管理：token 估算 + 历史消息截断。
// 长对话若把全部历史直接发给模型，必然超出上下文窗口报错，
// 这里在发送前按 token 预算从最新往前保留消息。

import { getConfig } from '../store/llmConfig';

// 每条消息除正文外的固定开销（role 等元信息的大致 token 数）
const PER_MESSAGE_OVERHEAD = 4;

/**
 * 粗略估算一段文本的 token 数。
 * 经验规则：CJK（中日韩）字符约 1 字 = 1 token，其他字符约 4 字符 = 1 token。
 * 不追求精确，偏保守即可——目的是避免超窗，而不是精确计费。
 */
function estimateTokens(text) {
  if (!text) return 0;
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    // 常用 CJK 区段：汉字、日文假名、全角符号、CJK 标点
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3000 && code <= 0x30ff) ||
      (code >= 0xff00 && code <= 0xffef)
    ) {
      cjk++;
    } else {
      other++;
    }
  }
  return Math.ceil(cjk + other / 4);
}

// 视觉消息里单张图片的估算 token 开销（各家计费不同，取保守值）
const PER_IMAGE_TOKENS = 1000;

/**
 * 估算一条消息 content 的 token 数。
 * content 可能是纯字符串，也可能是 vision 格式的数组（text + image_url 块）。
 */
function estimateContentTokens(content) {
  if (typeof content === 'string') return estimateTokens(content);
  if (Array.isArray(content)) {
    return content.reduce((sum, part) => {
      if (part?.type === 'text') return sum + estimateTokens(part.text);
      if (part?.type === 'image_url') return sum + PER_IMAGE_TOKENS;
      return sum;
    }, 0);
  }
  return 0;
}

/**
 * 按 token 预算截断会话历史。
 * 策略：
 * 1. system 消息（若有）始终保留，其 token 计入预算；
 * 2. 其余消息从最新往前累加，超出预算即停止；
 * 3. 最新一条消息无论多长都保留（否则没法发起请求）；
 * 4. 截断后如果开头是 assistant 消息则丢弃，保证对话以 user 开头，
 *    避免部分 API 拒绝"assistant 打头"的消息序列。
 *
 * @param {Array<{role: string, content: string}>} messages 完整会话
 * @param {number} [maxTokens] token 预算，默认读取配置中心的用户设置（含默认值兜底）
 * @returns 截断后的会话
 */
export function trimConversation(messages, maxTokens = getConfig().contextTokens) {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  // 拆出开头的 system 消息（一般只有一条）
  const systemMessages = [];
  let rest = messages;
  while (rest.length && rest[0].role === 'system') {
    systemMessages.push(rest[0]);
    rest = rest.slice(1);
  }

  let used = systemMessages.reduce(
    (sum, m) => sum + estimateContentTokens(m.content) + PER_MESSAGE_OVERHEAD,
    0
  );

  const kept = [];
  for (let i = rest.length - 1; i >= 0; i--) {
    const cost = estimateContentTokens(rest[i].content) + PER_MESSAGE_OVERHEAD;
    // 至少保留最新一条，之后超预算即停
    if (kept.length > 0 && used + cost > maxTokens) break;
    kept.unshift(rest[i]);
    used += cost;
  }

  // 避免截断后以 assistant 开头（丢弃孤立的 assistant 回复）
  while (kept.length > 1 && kept[0].role === 'assistant') {
    kept.shift();
  }

  return [...systemMessages, ...kept];
}
