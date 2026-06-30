import request from "./config";
import { WEBUI_API_BASE_URL, OLLAMA_API_BASE_URL, WEBUI_BASE_URL, USE_LOCAL_DATA } from '../constants';
import { buildDemoReply } from '../constants/demoReplies';

const isDemoMode = () => USE_LOCAL_DATA || localStorage.getItem('demo_mode') === 'true';

const streamDemoReply = async (reply, callback, signal) => {
  // 逐字符发送，标点/换行后加额外停顿，模拟真实打字节奏
  const PAUSE = { '。': 120, '！': 120, '？': 120, '，': 60, '、': 60, '\n': 80 };
  const BASE = 22; // 基础每字符延迟 ms
  const JITTER = 18; // 随机抖动范围

  for (let i = 0; i < reply.length; i++) {
    if (signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError');

    const char = reply[i];
    callback(char);

    const extra = PAUSE[char] ?? 0;
    const delay = BASE + extra + Math.random() * JITTER;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  callback('[DONE]');
};
export const queryMemory = (params) => {
  const { content, token } = params;
  if (isDemoMode()) {
    // 本地模式：返回空记忆列表
    return Promise.resolve({ data: { documents: [], metadatas: [], distances: [] }, status: 200, statusText: 'OK' });
  }
  // 后端接口（USE_LOCAL_DATA = false 时生效）
  return request.post(`${WEBUI_API_BASE_URL}/memories/query`, { content, token });
};

export const createNewChat = (params = {}) => {
  if (isDemoMode()) {
    // 本地模式：返回模拟的新建对话响应
    return Promise.resolve({ data: { id: '', title: '新对话' }, status: 200, statusText: 'OK' });
  }
  // 后端接口（USE_LOCAL_DATA = false 时生效）
  const chat = params.chat ?? {
    id: '', title: '新对话', models: ['llama3.1:latest'], params: {}, messages: [], tags: [], timestamp: Date.now(),
  };
  return request.post(`${WEBUI_API_BASE_URL}/chats/new`, { chat });
};



export const generateChatCompletion = async (params, callback,signal) => {
  const { chat_id, id, messages, model, options, session_id, stream } = params;

  const provider = localStorage.getItem('llm_provider') || 'demo';
  let customKey = localStorage.getItem('llm_api_key') || '';
  if (customKey.startsWith('b64:')) {
    try {
      customKey = atob(customKey.slice(4));
    } catch {
      // fallback
    }
  }
  const customUrl = localStorage.getItem('llm_api_url') || 'https://api.openai.com/v1';
  const customModel = localStorage.getItem('llm_model') || 'gpt-4o-mini';

  if (provider === 'custom' && customKey) {
    try {
      let url = customUrl.replace(/\/+$/, '');
      if (!url.endsWith('/chat/completions')) {
        url = `${url}/chat/completions`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + customKey,
        },
        body: JSON.stringify({
          model: customModel,
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

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep last partial line
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanedLine = line.trim();
          if (!cleanedLine) continue;
          if (cleanedLine === 'data: [DONE]') {
            callback('[DONE]');
            continue;
          }
          if (cleanedLine.startsWith('data: ')) {
            try {
              const dataStr = cleanedLine.slice(6);
              if (dataStr === '[DONE]') {
                callback('[DONE]');
                continue;
              }
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                callback(content);
              }
            } catch (e) {
              console.error('Error parsing SSE line:', e, cleanedLine);
            }
          }
        }
      }

      // Check remaining buffer
      if (buffer.trim()) {
        const cleanedLine = buffer.trim();
        if (cleanedLine.startsWith('data: ')) {
          try {
            const dataStr = cleanedLine.slice(6);
            if (dataStr !== '[DONE]') {
              const parsed = JSON.parse(dataStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                callback(content);
              }
            }
          } catch {
            // ignore
          }
        }
      }

      // Finally end stream
      callback('[DONE]');
      return;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('请求被取消');
      } else {
        callback('请求失败，请检查您的网络连接或 API 配置。错误信息: ' + error.message);
        console.error('请求错误：', error);
      }
      return;
    }
  }

  if (isDemoMode()) {
    await streamDemoReply(buildDemoReply(messages), callback, signal);
    return;
  }

  try {
    const response = await fetch(`${OLLAMA_API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-vail': 'application/x-ndjson',
        'Authorization': localStorage.getItem('token'),
      },
      body: JSON.stringify({ chat_id, id, messages, model, options, session_id, stream }),
      signal, // 将 signal 传递给 fetch，以便控制请求的中断
    });

    if (!response.ok) {
      throw new Error('网络响应不正确');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    const bufferRef = { current: '' }; // 用于缓存未完成的 JSON 片段

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      // 处理数据块并保存未完成的部分
      processChunk(chunk, callback, bufferRef);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('请求被取消');
    } else {
      // 更精确的错误处理
      callback({ error: '请求失败，请检查网络连接或稍后重试。' });
      console.error('请求错误：', error);
    }
  }
};



const processChunk = (chunkStr, callback, bufferRef) => {
  try {
    // 将上次未解析完的部分和新数据拼接在一起
    chunkStr = bufferRef.current + chunkStr;

    // 使用正则表达式查找完整的 JSON 对象
    const jsonMatches = chunkStr.match(/({.*?})(?=\s|$)/g);

    if (jsonMatches) {
      jsonMatches.forEach((jsonStr) => {
        try {
          const chunk = JSON.parse(jsonStr);

          if (chunk.done) {
            callback('[DONE]');
          } else if (chunk.message && chunk.message.content) {
            callback(chunk.message.content);
          }
        } catch (jsonError) {
          console.error('JSON 解析错误：', jsonError);
        }
      });
    }

    // 缓存未完整的 JSON 字符串
    const lastIndex = chunkStr.lastIndexOf('}');
    bufferRef.current = lastIndex === chunkStr.length - 1 ? '' : chunkStr.slice(lastIndex + 1);
  } catch (error) {
    console.error('解析数据错误：', error);
  }
};


export const generateTitle = (params) => {
  const { model, prompt, chat_id } = params
  if (isDemoMode()) {
    return Promise.resolve({
      statusText: 'OK',
      data: {
        title: prompt.trim().slice(0, 20) || '新对话',
        chat_id,
        model,
      },
    });
  }
  return request.post(`${WEBUI_BASE_URL}/api/task/title/completions`, { model, prompt, chat_id })
};
