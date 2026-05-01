import { BaseProvider } from './base';
import { getConfig } from '../../store/llmConfig';
import { createSseThinkAdapter } from './thinkTags';

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
      headers['Authorization'] = `Bearer ${apiKey}`;
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
      // 常见状态码翻译成用户能行动的提示，原始信息附在后面便于排查
      const friendly =
        response.status === 401
          ? 'API Key 无效或已过期，请到设置里检查密钥'
          : response.status === 403
          ? '没有访问该模型的权限（Key 权限不足或余额受限）'
          : response.status === 429
          ? '请求过于频繁或配额已用尽，请稍后重试'
          : response.status === 402
          ? '账户余额不足，请前往平台充值'
          : response.status >= 500
          ? '模型服务暂时不可用，请稍后重试'
          : 'API 响应错误';
      throw new Error(`${friendly}（HTTP ${response.status}）：${errorText.slice(0, 300)}`);
    }

    // 思考流差异（reasoning_content / reasoning / 内联 <think> 标签）由共用适配器吸收
    const { wrappedCallback, dataParser } = createSseThinkAdapter(callback, thinkEnabled);
    await this.parseStream(response.body, wrappedCallback, signal, dataParser);
  }
}
