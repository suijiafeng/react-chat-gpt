import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generateChatCompletion, createNewChat, generateTitle } from '../apis/chat';
import {saveMessageToDB, loadMessagesFromDB, clearChatHistory} from '../store/db'

const messagesReducer = (state, action) => {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return [...state, action.payload];
    case 'UPDATE_MESSAGE':
      return state.map((msg) =>
        msg.id === action.id ? { ...msg, text: msg.text + action.payload } : msg
      );
    default:
      return state;
  }
};

export const useChat = (currentModel) => {
  const [messages, dispatchMessages] = useReducer(messagesReducer, []);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [controller, setController] = useState(null); // 用于控制请求中止
  const messagesEndRef = useRef(null);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 加载历史记录
  useEffect(() => {
    const loadHistory = async () => {
      const history = await loadMessagesFromDB(); // 从 IndexedDB 加载历史记录
      if (history.length > 0) {
        history.forEach((msg) => {
          dispatchMessages({ type: 'ADD_MESSAGE', payload: msg });
        });
      }
    };
    loadHistory();
  }, []);

  // 清理中止控制器
  useEffect(() => {
    return () => {
      if (controller) {
        controller.abort(); // 组件卸载时停止任何进行中的请求
      }
    };
  }, [controller]);

  const handleNewChat = useCallback(async () => {
    await createNewChat();
  }, []);

  const handleChatCompletion = useCallback(
    async (input, conversation) => {
      const userMessageId = uuidv4();
      const aiMessageId = uuidv4();

      const userMessage = { id: userMessageId, text: input, isUser: true };
      const aiMessage = { id: aiMessageId, text: '', isUser: false };

      dispatchMessages({ type: 'ADD_MESSAGE', payload: userMessage });
      dispatchMessages({ type: 'ADD_MESSAGE', payload: aiMessage });
      await saveMessageToDB(userMessage); // 保存用户消息到 IndexedDB

      setInput("");
      setIsStreaming(true);

      let aiMessageContent = ''; // 用于拼接所有的 chunk

      const abortController = new AbortController(); // 创建新的 AbortController
      setController(abortController); // 设置控制器

      try {
        await generateChatCompletion(
          {
            stream: true,
            model: currentModel,
            messages: conversation,
            options: {},
            session_id: uuidv4(),
            chat_id: uuidv4(),
            id: uuidv4(),
          },
          (chunk) => {
            if (chunk === '[DONE]') {
              setIsStreaming(false);
              generateTitle({ model: currentModel, prompt: input, chat_id: '' });
              setController(null); // 请求完成后清空控制器

              // 完整的消息拼接完成后，保存到 IndexedDB
              const completeAiMessage = { ...aiMessage, text: aiMessageContent };
              saveMessageToDB(completeAiMessage); // 保存完整的 AI 消息
              return;
            }

            aiMessageContent += chunk; // 拼接 chunk 到临时变量
            updateMessage(aiMessageId, chunk); // 更新 UI
          },
          abortController.signal // 将 signal 传递给请求
        );
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('请求被取消');
        } else {
          console.error('Error generating chat completion:', error);
        }
        setIsStreaming(false);
        setController(null); // 请求出错或被取消后，清空控制器
      }
    },
    [currentModel]
  );

  const cancelChatCompletion = useCallback(() => {
    if (controller) {
      controller.abort(); // 中止请求
      setController(null); // 清空控制器
      setIsStreaming(false); // 更新状态
    }
  }, [controller]);

  const updateMessage = useCallback((id, chunk) => {
    dispatchMessages({ type: 'UPDATE_MESSAGE', id: id, payload: chunk });
  }, []);

  const clearHistory = useCallback(async () => {
    await clearChatHistory(); // 清空 IndexedDB 中的聊天记录
    dispatchMessages({ type: 'CLEAR_HISTORY' }); // 清空状态中的消息
  }, []);

  return {
    messages,
    input,
    setInput,
    isStreaming,
    handleNewChat,
    handleChatCompletion,
    updateMessage,
    messagesEndRef,
    cancelChatCompletion, // 返回取消请求的方法
    clearHistory, // 清空历史记录
  };
};