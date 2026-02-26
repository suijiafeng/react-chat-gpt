import { BaseProvider } from './base';
import { getConfig } from '../../store/llmConfig';
import { createThinkSplitter, deltaReasoning } from './thinkTags';

// 是否 Ollama 端点（默认端口判断）。think 参数只有 Ollama 认；
// OpenAI 官方等严格校验的平台会对未知参数直接 400，不能无脑携带。
const isOllamaUrl = (url) => /:11434\b/.test(url);

export class OpenAIProvider extends BaseProvider {
  async complete(params, callback, signal) {
    const { messages, think } = params;
    const thinkEnabled = Boolean(think);

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
        // think 参数只发给 Ollama（其兼容层支持）；其他平台不携带——
        // OpenAI 官方 API 对未知参数严格校验会 400，DeepSeek 等平台则直接忽略
        ...(isOllamaUrl(apiUrl) ? { think: thinkEnabled } : {}),
      }),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 响应错误 (${response.status}): ${errorText}`);
    }

    // 部分平台把思维链以 <think> 标签内联在 content 里（且标签可能被流切成两半），
    // 用分流器拆成可见文本 / 思考文本；流结束时冲刷缓冲，避免尾部字符丢失
    const splitter = createThinkSplitter();
    const wrappedCallback = (content, meta) => {
      if (content === '[DONE]') {
        const rest = splitter.flush();
        if (rest.visible) callback(rest.visible);
        if (rest.reasoning && thinkEnabled) callback(rest.reasoning, { isReasoning: true });
      }
      callback(content, meta);
    };

    await this.parseStream(
      response.body,
      wrappedCallback,
      signal,
      (parsed) => {
        // 流中错误对象（OpenAI 系平台在流中报错的标准形态是 data: {"error":{...}}，
        // 自建代理上游中断时也会发同形态的错误块）——标记为错误交给 UI 红色气泡展示
        if (parsed.error) {
          const msg = parsed.error.message || JSON.stringify(parsed.error).slice(0, 200);
          return { content: `上游返回错误：${msg}`, meta: { isError: true } };
        }

        const delta = parsed.choices?.[0]?.delta;
        const chunks = [];

        // 独立思考字段：DeepSeek/通义/智谱等用 reasoning_content，Ollama 兼容层用 reasoning。
        // think 关闭时丢弃不展示（这类平台的思考生成不受请求参数控制，只能在展示层过滤）
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

        return chunks.length ? chunks : null;
      }
    );
  }
}
