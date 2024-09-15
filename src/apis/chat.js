import request from "./config";
import { WEBUI_API_BASE_URL, OLLAMA_API_BASE_URL } from '../constants'
export const queryMemory = (params) => {
  const { content, token } = params
  return request.post(`${WEBUI_API_BASE_URL}/memories/query`, { content, token })
}
export const generateChatCompletion = (params, callback) => {
  const { chat_id, id, messages, model, options, session_id, stream } = params
  let buffer = '';
  return request.post(`${OLLAMA_API_BASE_URL}/api/chat`, { chat_id, id, messages, model, options, session_id, stream }, {
    headers: {
      'x-vail': 'application/x-ndjson',
      Authorization: localStorage.getItem('token')
    },
    responseType: "text",
    onDownloadProgress: (progressEvent => {
      const responseText = progressEvent.event.target.response;
      const chunk = responseText.substring(buffer.length);
      buffer = responseText;
      callback?.(chunk,responseText)
    })
  })
}
