import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generateChatCompletion, generateTitle } from '../apis/chat';
import {
  saveMessageToDB,
  loadMessagesBySession,
  loadMessagesBySessionPaged,
  clearSessionMessages,
  updateSessionTitle,
  touchSession,
} from '../store/db';

const messagesReducer = (state, action) => {
  switch (action.type) {
    case 'SET_MESSAGES':
      return action.payload;
    case 'ADD_MESSAGE':
      return [...state, action.payload];
    case 'PREPEND_MESSAGES':
      return [...action.payload, ...state];
    case 'UPDATE_MESSAGE':
      return state.map((msg) =>
        msg.id === action.id ? { ...msg, text: msg.text + action.payload } : msg
      );
    case 'CLEAR_HISTORY':
      return [];
    default:
      return state;
  }
};

export const useChat = (currentModel, sessionId) => {
  const [messages, dispatchMessages] = useReducer(messagesReducer, []);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [controller, setController] = useState(null);
  const messagesEndRef = useRef(null);
  const sessionIdRef = useRef(sessionId);
  // 新建会话首次发消息时，直接在内存里持有消息，跳过 DB 重读
  const skipNextLoadRef = useRef(false);

  // 分页及滚动控制相关状态
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const skipScrollToBottomRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // 自动滚动到最新消息
  useEffect(() => {
    if (skipScrollToBottomRef.current) {
      skipScrollToBottomRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 当 sessionId 变化时，加载对应会话的消息
  useEffect(() => {
    if (!sessionId) {
      dispatchMessages({ type: 'CLEAR_HISTORY' });
      setHasMore(false);
      return;
    }
    // 新建会话首次发送时已在内存中持有消息，跳过 DB 重读避免竞态
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      setHasMore(false);
      return;
    }
    const load = async () => {
      setIsLoadingMore(true);
      try {
        const PAGE_SIZE = 30;
        const history = await loadMessagesBySessionPaged(sessionId, PAGE_SIZE, 0);
        dispatchMessages({ type: 'SET_MESSAGES', payload: history });
        if (history.length < PAGE_SIZE) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }
      } catch (error) {
        console.error('Error loading initial messages:', error);
      } finally {
        setIsLoadingMore(false);
      }
    };
    load();
  }, [sessionId]);

  // 加载更多历史消息
  const loadMoreMessages = useCallback(async () => {
    if (!sessionId || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const PAGE_SIZE = 30;
      const olderMessages = await loadMessagesBySessionPaged(sessionId, PAGE_SIZE, messages.length);
      if (olderMessages.length < PAGE_SIZE) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
      if (olderMessages.length > 0) {
        skipScrollToBottomRef.current = true;
        dispatchMessages({ type: 'PREPEND_MESSAGES', payload: olderMessages });
      }
    } catch (error) {
      console.error('Error loading older messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [sessionId, isLoadingMore, hasMore, messages.length]);

  // 组件卸载时中止请求
  useEffect(() => {
    return () => {
      if (controller) controller.abort();
    };
  }, [controller]);

  const handleChatCompletion = useCallback(
    async (input, conversation, directSessionId) => {
      // directSessionId：新建会话时由外部直接传入，避免等待 React state 更新
      if (directSessionId) {
        skipNextLoadRef.current = true;   // 告知 load effect 跳过本次 DB 重读
        sessionIdRef.current = directSessionId; // 立即更新 ref，无需等 useEffect
      }
      const activeSessionId = directSessionId || sessionIdRef.current;
      if (!activeSessionId) return;

      const userMessageId = uuidv4();
      const aiMessageId = uuidv4();

      const userMessage = { id: userMessageId, text: input, isUser: true };
      const aiMessage = { id: aiMessageId, text: '', isUser: false };

      dispatchMessages({ type: 'ADD_MESSAGE', payload: userMessage });
      dispatchMessages({ type: 'ADD_MESSAGE', payload: aiMessage });
      await saveMessageToDB(userMessage, activeSessionId);

      setInput('');
      setIsStreaming(true);

      let aiMessageContent = '';

      const abortController = new AbortController();
      setController(abortController);

      try {
        await generateChatCompletion(
          {
            stream: true,
            model: currentModel,
            messages: conversation,
            options: {},
            session_id: activeSessionId,
            chat_id: activeSessionId,
            id: uuidv4(),
          },
          async (chunk) => {
            if (chunk === '[DONE]') {
              setIsStreaming(false);
              setController(null);

              const completeAiMessage = { ...aiMessage, text: aiMessageContent };
              await saveMessageToDB(completeAiMessage, activeSessionId);
              await touchSession(activeSessionId);

              // 首条对话结束后，自动生成标题
              if (conversation.length === 1) {
                try {
                  const titleResponse = await generateTitle({
                    model: currentModel,
                    prompt: input,
                    chat_id: activeSessionId,
                  });
                  const nextTitle =
                    titleResponse?.data?.title ||
                    titleResponse?.data?.data?.title ||
                    input.trim().slice(0, 20);

                  if (nextTitle) {
                    await updateSessionTitle(activeSessionId, nextTitle);
                  }
                } catch (error) {
                  console.error('Error generating title:', error);
                }
              }
              return;
            }

            aiMessageContent += chunk;
            dispatchMessages({ type: 'UPDATE_MESSAGE', id: aiMessageId, payload: chunk });
          },
          abortController.signal
        );
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error generating chat completion:', error);
        }
        setIsStreaming(false);
        setController(null);
      }
    },
    [currentModel]
  );

  const cancelChatCompletion = useCallback(() => {
    if (controller) {
      controller.abort();
      setController(null);
      setIsStreaming(false);
    }
  }, [controller]);

  const clearHistory = useCallback(async () => {
    if (!sessionId) return;
    await clearSessionMessages(sessionId);
    dispatchMessages({ type: 'CLEAR_HISTORY' });
  }, [sessionId]);

  return {
    messages,
    input,
    setInput,
    isStreaming,
    handleChatCompletion,
    messagesEndRef,
    cancelChatCompletion,
    clearHistory,
    hasMore,
    isLoadingMore,
    loadMoreMessages,
  };
};
