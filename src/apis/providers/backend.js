import { BaseProvider } from './base';
import { WEBUI_API_BASE_URL } from '../../constants';
import { handleSessionExpired } from '../../utils/session';
import { createThinkSplitter, deltaReasoning } from './thinkTags';

// 走自建后端转发：真实 API Key 只存在服务端，浏览器完全接触不到；
// 同时天然绕开各模型商的 CORS 限制（服务端对服务端请求不受同源策略约束）。
// 后端需要登录后的 session cookie 才认，所以这里必须 credentials: 'include'。
export class BackendProvider extends BaseProvider {
  async complete(params, callback, signal) {
    const { messages, model, think } = params;
    const thinkEnabled = Boolean(think);

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
      // 会话失效：清理本地登录态并跳登录页（流式请求走原生 fetch，不经 axios 拦截器）
      if (response.status === 401) handleSessionExpired();
      let detail = '';
      try {
        detail = (await response.json())?.message || '';
      } catch {
        // 响应体不是 JSON，忽略
      }
      throw new Error(`后端代理返回错误 (${response.status})${detail ? '：' + detail : ''}`);
    }

    // 代理是原样透传上游 SSE 的，字段差异（reasoning_content/reasoning/<think> 标签）
    // 与 custom 模式一样在这里吸收；think 关闭时丢弃思考内容不展示
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
        const delta = parsed.choices?.[0]?.delta;
        const chunks = [];

        const reasoning = deltaReasoning(delta);
        if (reasoning && thinkEnabled) {
          chunks.push({ content: reasoning, meta: { isReasoning: true } });
        }

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
