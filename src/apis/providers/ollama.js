import { BaseProvider } from './base';
import { OLLAMA_API_BASE_URL } from '../../constants';
import { contentToText } from '../../utils/attachments';

// OpenAI vision 数组 content → Ollama 原生格式：
// content 只能是字符串，图片走独立的 images 字段（裸 base64，不带 data: 前缀）
const toOllamaMessage = (msg) => {
  if (typeof msg.content === 'string') return msg;
  const images = (Array.isArray(msg.content) ? msg.content : [])
    .filter((part) => part?.type === 'image_url')
    .map((part) => part.image_url?.url?.replace(/^data:[^,]+,/, ''))
    .filter(Boolean);
  return {
    role: msg.role,
    content: contentToText(msg.content),
    ...(images.length ? { images } : {}),
  };
};

export class OllamaProvider extends BaseProvider {
  async complete(params, callback, signal) {
    const { chat_id, id, messages, model, options, session_id, stream, think } = params;

    const response = await fetch(`${OLLAMA_API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id,
        id,
        messages: messages.map(toOllamaMessage),
        model,
        options,
        session_id,
        stream,
        think: Boolean(think),
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error('网络响应不正确');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    // [DONE] 只发一次：done 块与流关闭兜底不重复触发下游收尾逻辑
    let doneSent = false;

    const sendDone = () => {
      if (doneSent) return;
      doneSent = true;
      callback('[DONE]');
    };

    // 处理一行 ndjson（读循环与流关闭后的尾部缓冲共用同一套逻辑）
    const handleLine = (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      try {
        const chunk = JSON.parse(trimmed);
        if (chunk.done) {
          sendDone();
          return;
        }
        if (chunk.message?.thinking) {
          callback(chunk.message.thinking, { isReasoning: true });
        }
        if (chunk.message?.content) {
          callback(chunk.message.content);
        }
      } catch (jsonError) {
        console.error('Ollama JSON 解析错误：', jsonError, trimmed);
      }
    };

    try {
      while (true) {
        if (signal?.aborted) {
          // 保留真实的中止原因（比如超时看门狗构造的 TimeoutError），
          // 不要一律说成通用 AbortError，上层要靠 error.name 区分场景
          throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
        }

        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Ollama utilizes newline-delimited JSON (ndjson)
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        lines.forEach(handleLine);
      }

      // Check remaining buffer
      handleLine(buffer);

      // Always end stream
      sendDone();
    } finally {
      reader.releaseLock();
    }
  }
}
