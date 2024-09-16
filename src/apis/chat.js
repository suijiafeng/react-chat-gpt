import request from "./config";
import { WEBUI_API_BASE_URL, OLLAMA_API_BASE_URL, WEBUI_BASE_URL } from '../constants'
export const queryMemory = (params) => {
  const { content, token } = params
  return request.post(`${WEBUI_API_BASE_URL}/memories/query`, { content, token })
}

export const createNewChat =  (params) => {
	// const {chat} = {params}
  const chat = {"chat":{"id":"","title":"新对话","models":["llama3.1:latest"],"params":{},"messages":[{"id":"2e5c2c87-c640-4c40-b62d-49f5bd095ec0","parentId":null,"childrenIds":["6cefd5cf-2092-4118-b1e6-5f0acbfed427"],"role":"user","content":"666","timestamp":1726466098,"models":["llama3.1:latest"]},{"parentId":"2e5c2c87-c640-4c40-b62d-49f5bd095ec0","id":"6cefd5cf-2092-4118-b1e6-5f0acbfed427","childrenIds":[],"role":"assistant","content":"","model":"llama3.1:latest","modelName":"llama3.1:latest","modelIdx":0,"userContext":null,"timestamp":1726466098}],"history":{"messages":{"2e5c2c87-c640-4c40-b62d-49f5bd095ec0":{"id":"2e5c2c87-c640-4c40-b62d-49f5bd095ec0","parentId":null,"childrenIds":["6cefd5cf-2092-4118-b1e6-5f0acbfed427"],"role":"user","content":"666","timestamp":1726466098,"models":["llama3.1:latest"]},"6cefd5cf-2092-4118-b1e6-5f0acbfed427":{"parentId":"2e5c2c87-c640-4c40-b62d-49f5bd095ec0","id":"6cefd5cf-2092-4118-b1e6-5f0acbfed427","childrenIds":[],"role":"assistant","content":"","model":"llama3.1:latest","modelName":"llama3.1:latest","modelIdx":0,"userContext":null,"timestamp":1726466098}},"currentId":"6cefd5cf-2092-4118-b1e6-5f0acbfed427"},"tags":[],"timestamp":1726466098996}}

	return request.post(`${WEBUI_API_BASE_URL}/chats/new`,{chat})
};



export const generateChatCompletion = async (params, callback,signal) => {
  const { chat_id, id, messages, model, options, session_id, stream } = params;

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
  return request.post(`${WEBUI_BASE_URL}/api/task/title/completions`, { model, prompt, chat_id })
};
