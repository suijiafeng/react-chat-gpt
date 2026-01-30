import { BaseProvider } from './base';
import { OLLAMA_API_BASE_URL } from '../../constants';

export class OllamaProvider extends BaseProvider {
  async complete(params, callback, signal) {
    const { chat_id, id, messages, model, options, session_id, stream, think } = params;

    const response = await fetch(`${OLLAMA_API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vail': 'application/x-ndjson',
        'Authorization': localStorage.getItem('token') || '',
      },
      body: JSON.stringify({ chat_id, id, messages, model, options, session_id, stream, think: Boolean(think) }),
      signal,
    });

    if (!response.ok) {
      throw new Error('网络响应不正确');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

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

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            const chunk = JSON.parse(trimmed);
            if (chunk.done) {
              callback('[DONE]');
            } else {
              if (chunk.message?.thinking) {
                callback(chunk.message.thinking, { isReasoning: true });
              }
              if (chunk.message?.content) {
                callback(chunk.message.content);
              }
            }
          } catch (jsonError) {
            console.error('Ollama JSON 解析错误：', jsonError, trimmed);
          }
        }
      }

      // Check remaining buffer
      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer.trim());
          if (chunk.done) {
            callback('[DONE]');
          } else {
            if (chunk.message?.thinking) {
              callback(chunk.message.thinking, { isReasoning: true });
            }
            if (chunk.message?.content) {
              callback(chunk.message.content);
            }
          }
        } catch {
          // ignore
        }
      }

      // Always end stream
      callback('[DONE]');
    } finally {
      reader.releaseLock();
    }
  }
}
