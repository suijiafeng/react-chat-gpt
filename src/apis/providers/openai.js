import { BaseProvider } from './base';

export class OpenAIProvider extends BaseProvider {
  async complete(params, callback, signal) {
    const { messages } = params;

    let apiKey = localStorage.getItem('llm_api_key') || '';
    if (apiKey.startsWith('b64:')) {
      try {
        apiKey = atob(apiKey.slice(4));
      } catch {
        // fallback
      }
    }
    const apiUrl = localStorage.getItem('llm_api_url') || 'https://api.openai.com/v1';
    const customModel = localStorage.getItem('llm_model') || 'gpt-4o-mini';

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
      (parsed) => parsed.choices?.[0]?.delta?.content
    );
  }
}
