import { BaseProvider } from './base';
import { WEBUI_API_BASE_URL } from '../../constants';

// 走自建后端转发：真实 API Key 只存在服务端，浏览器完全接触不到；
// 同时天然绕开各模型商的 CORS 限制（服务端对服务端请求不受同源策略约束）。
// 后端需要登录后的 session cookie 才认，所以这里必须 credentials: 'include'。
export class BackendProvider extends BaseProvider {
  async complete(params, callback, signal) {
    const { messages, model, think } = params;

    const response = await fetch(`${WEBUI_API_BASE_URL}/llm/chat/completions`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        think: Boolean(think),
      }),
      signal,
    });

    if (!response.ok) {
      let detail = '';
      try {
        detail = (await response.json())?.message || '';
      } catch {
        // 响应体不是 JSON，忽略
      }
      throw new Error(`后端代理返回错误 (${response.status})${detail ? '：' + detail : ''}`);
    }

    await this.parseStream(
      response.body,
      callback,
      signal,
      (parsed) => {
        const delta = parsed.choices?.[0]?.delta;
        if (delta?.reasoning) {
          return { content: delta.reasoning, meta: { isReasoning: true } };
        }
        if (delta?.content) {
          return { content: delta.content };
        }
        return null;
      }
    );
  }
}
