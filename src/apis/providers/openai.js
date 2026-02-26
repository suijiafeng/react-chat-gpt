import { BaseProvider } from './base';
import { getConfig } from '../../store/llmConfig';

export class OpenAIProvider extends BaseProvider {
  async complete(params, callback, signal) {
    const { messages, think } = params;
    const thinkEnabled = Boolean(think);

    // 当 think 关闭时，部分 OpenAI 兼容实现仍会把思考链包在 <think>...</think> 里放到 content。
    // 这里做增量剥离，避免跨 chunk 的半截标签漏出到 UI。
    let inThinkTag = false;
    let tagBuffer = '';
    const stripThinkTags = (input) => {
      if (!input) return '';
      const source = tagBuffer + input;
      let output = '';
      let i = 0;

      while (i < source.length) {
        if (inThinkTag) {
          const end = source.indexOf('</think>', i);
          if (end === -1) {
            // 仍在 think 段内，保留末尾少量字符以匹配跨 chunk 的闭合标签
            tagBuffer = source.slice(Math.max(source.length - 8, 0));
            return output;
          }
          i = end + 8;
          inThinkTag = false;
          continue;
        }

        const start = source.indexOf('<think>', i);
        if (start === -1) {
          // 保留末尾少量字符以匹配跨 chunk 的开标签
          const safeEnd = Math.max(i, source.length - 7);
          output += source.slice(i, safeEnd);
          tagBuffer = source.slice(safeEnd);
          return output;
        }

        output += source.slice(i, start);
        i = start + 7;
        inThinkTag = true;
      }

      tagBuffer = '';
      return output;
    };

    // 统一从配置中心读取（内部已处理 b64 解码、默认值），
    // 不再直接摸 localStorage，避免 key 名 / 编码方式散落多处
    const { apiKey, apiUrl, model: customModel } = getConfig();

    let url = apiUrl.replace(/\/+$/, '');
    if (!url.endsWith('/chat/completions')) {
      url = `${url}/chat/completions`;
    }

    const headers = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = ['Bearer', apiKey].join(' ');
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: params.model || customModel,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: true,
        // Ollama 的 OpenAI 兼容层支持 think 参数；其他平台会忽略未知字段
        think: Boolean(think),
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 响应错误 (${response.status}): ${errorText}`);
    }

    await this.parseStream(
      response.body,
      callback,
      signal,
      (parsed) => {
        const delta = parsed.choices?.[0]?.delta;
        // Ollama OpenAI 兼容层在 think:true 时通过 delta.reasoning 流式返回思考内容
        if (delta?.reasoning) {
          if (!thinkEnabled) return null;
          return { content: delta.reasoning, meta: { isReasoning: true } };
        }
        if (delta?.content) {
          const content = thinkEnabled ? delta.content : stripThinkTags(delta.content);
          return content ? { content } : null;
        }
        return null;
      }
    );
  }
}
