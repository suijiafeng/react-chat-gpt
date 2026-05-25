import { providerRegistry } from './providers';
// 演示/正式模式与 provider 的判断统一收敛在配置中心，这里只负责调用
import { isDemoMode, resolveProviderName } from '../store/llmConfig';

export const generateChatCompletion = async (params, callback, signal) => {
  const provider = providerRegistry.getProvider(resolveProviderName());

  try {
    await provider.complete(params, callback, signal);
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('请求被取消');
      return;
    }
    console.error('请求错误：', error);
    // 第二个参数标记这是错误文本，而不是模型的正常输出——
    // 调用方据此在气泡上做视觉区分（红色调 + 图标），不会和正常回复混为一谈。
    // TimeoutError 是 useChat 里的空闲看门狗主动中止时构造的，
    // 和"网络/配置问题"是两类不同的可能原因，分开提示更准确。
    const message =
      error.name === 'TimeoutError'
        ? `请求超时：${error.message}，已自动停止。`
        : '请求失败，请检查您的网络连接或 API 配置。错误信息: ' + error.message;
    callback(message, { isError: true });
    // provider 抛出异常时不会自己发出 [DONE]，这里补上，
    // 否则 useChat 里的流式状态（isStreaming/streamingRef）永远不会被正确清空。
    callback('[DONE]');
  }
};

// 标题兜底：直接截取用户首条消息的前 20 个字符
const fallbackTitle = (prompt) => (prompt || '').trim().slice(0, 20) || '新对话';

// 自动标题生成：不再依赖 Open-WebUI 形状的后端接口（本项目服务端并未实现，
// 后端模式下会 404），改为直接用当前配置的 provider 让模型起标题，
// 任何失败（网络、配置、模型输出为空）都回退到截断兜底，调用方无感知。
export const generateTitle = async (params) => {
  const { model, prompt, chat_id } = params;
  const wrap = (title) => ({ statusText: 'OK', data: { title, chat_id, model } });
  if (isDemoMode()) return wrap(fallbackTitle(prompt));

  try {
    const provider = providerRegistry.getProvider(resolveProviderName());
    let text = '';
    let hadError = false;
    await provider.complete(
      {
        stream: true,
        model,
        messages: [
          {
            role: 'user',
            content: `用不超过10个字为下面的对话起一个简短标题，只输出标题本身，不要引号和解释：\n${(prompt || '').slice(0, 500)}`,
          },
        ],
      },
      (chunk, meta) => {
        if (chunk === '[DONE]') return;
        if (meta?.isError) {
          hadError = true;
          return;
        }
        // 思考流不属于标题正文
        if (meta?.isReasoning) return;
        text += chunk;
      }
    );
    if (hadError) return wrap(fallbackTitle(prompt));
    const title = text
      .trim()
      .replace(/^["'「『《【]+|["'」』》】]+$/g, '')
      .slice(0, 30);
    return wrap(title || fallbackTitle(prompt));
  } catch {
    return wrap(fallbackTitle(prompt));
  }
};
