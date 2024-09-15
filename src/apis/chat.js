import request from "./config";
import { WEBUI_API_BASE_URL, OLLAMA_API_BASE_URL } from '../constants'
export const queryMemory = (params) => {
  const { content, token } = params
  return request.post(`${WEBUI_API_BASE_URL}/memories/query`, { content, token })
}

export const generateChatCompletion = async (params, callback) => {
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
    console.error('请求错误：', error);
  }
};


const processChunk = (chunkStr, callback, bufferRef) => {
  try {
    // 在传入的新数据块前，拼接之前的缓冲区内容
    chunkStr = bufferRef.current + chunkStr;

    let index = 0;
    const length = chunkStr.length;

    // 用于追踪括号匹配情况
    let braceCount = 0;
    let start = null;

    while (index < length) {
      const char = chunkStr[index];

      if (char === '{') {
        if (braceCount === 0) {
          start = index; // 标记JSON对象的开始位置
        }
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && start !== null) {
          // 找到了一个完整的 JSON 对象
          const jsonStr = chunkStr.slice(start, index + 1);

          try {
            const chunk = JSON.parse(jsonStr); // 尝试解析 JSON

            if (chunk.done) {
              callback('[DONE]');
            } else {
              const content = chunk.message.content;
              if (content) {
                callback(content);
              }
            }
          } catch (jsonError) {
            console.error('JSON 解析错误：', jsonError);
          }

          // 重置 start
          start = null;
        }
      }

      index++;
    }

    // 如果有剩余的未完整的部分，将其存入缓冲区
    if (braceCount !== 0 && start !== null) {
      bufferRef.current = chunkStr.slice(start);
    } else {
      bufferRef.current = ''; // 否则清空缓冲区
    }
  } catch (error) {
    console.error('解析数据错误：', error);
  }
};
