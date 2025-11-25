import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { generateChatCompletion, generateTitle } from '../apis/chat';
import {
  saveMessageToDB,
  loadMessagesBySessionPaged,
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

export const useChat = (currentModel, sessionId, onSessionTouched) => {
  const [messages, dispatchMessages] = useReducer(messagesReducer, []);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  const sessionIdRef = useRef(sessionId);
  // 新建会话首次发消息时，直接在内存里持有消息，跳过 DB 重读
  const skipNextLoadRef = useRef(false);
  // 记录当前这个 hook 实例正在追踪的流式请求：{ messageId, sessionId, controller, getContent }
  // 这是"有没有请求在飞、属于哪个会话"的唯一数据来源
  const streamingRef = useRef(null);
  // 用 ref 镜像最新的 onSessionTouched，避免它成为下面 useCallback 的依赖
  const onSessionTouchedRef = useRef(onSessionTouched);
  useEffect(() => {
    onSessionTouchedRef.current = onSessionTouched;
  }, [onSessionTouched]);

  // 分页及滚动控制相关状态
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const skipScrollToBottomRef = useRef(false);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // 中止一个流式请求，并把它已经生成的部分内容保存下来。
  // 不管是用户主动点"停止"、切换到了别的会话，还是组件被卸载，统一走这一个函数，
  // 保证"离开一个还在生成中的会话"时的行为是一致、可预期的，不会丢内容。
  const abortAndPersistPending = useCallback((pending) => {
    if (!pending) return;
    pending.controller?.abort();
    const partialText = pending.getContent();
    if (partialText) {
      saveMessageToDB({ id: pending.messageId, text: partialText, isUser: false }, pending.sessionId)
        .then(() => touchSession(pending.sessionId))
        .then(() => onSessionTouchedRef.current?.())
        .catch((error) => console.error('Error saving partial message:', error));
    }
  }, []);

  // 自动滚动到最新消息
  useEffect(() => {
    if (skipScrollToBottomRef.current) {
      skipScrollToBottomRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 切换会话（包括跳转到 /new）时，如果上一个会话还有没结束的流式请求，
  // 主动中止并保存它已生成的部分内容——避免它在后台裸跑，
  // 和切换后的新会话共用同一份 isStreaming/streamingRef 状态而互相干扰。
  useEffect(() => {
    const pending = streamingRef.current;
    if (pending && pending.sessionId !== sessionId) {
      streamingRef.current = null;
      setIsStreaming(false);
      abortAndPersistPending(pending);
    }
  }, [sessionId, abortAndPersistPending]);

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
    // 先清空上一个会话残留的消息，避免切换/刷新时短暂显示错误内容；
    // hasMore 也重置为 true，避免沿用上一个会话的旧值导致"加载中"提示该出现时没出现
    dispatchMessages({ type: 'CLEAR_HISTORY' });
    setHasMore(true);
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
  // 返回值：本次实际加载到的历史消息条数（0 表示没有更多/未加载到新内容）
  const loadMoreMessages = useCallback(async () => {
    if (!sessionId || isLoadingMore || !hasMore) return 0;
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
      return olderMessages.length;
    } catch (error) {
      console.error('Error loading older messages:', error);
      return 0;
    } finally {
      setIsLoadingMore(false);
    }
  }, [sessionId, isLoadingMore, hasMore, messages.length]);

  // 组件真正卸载时（区别于上面的"切换会话"），兜底中止并保存还没结束的流式请求。
  // 依赖数组特意留空：只在挂载/卸载时绑定一次，cleanup 通过 ref 读取最新状态即可，
  // 不需要像之前那样依赖 controller、导致每次请求开始/结束都触发一次这个 cleanup。
  useEffect(() => {
    return () => {
      const pending = streamingRef.current;
      streamingRef.current = null;
      abortAndPersistPending(pending);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChatCompletion = useCallback(
    async (input, conversation, directSessionId) => {
      // directSessionId：新建会话时由外部直接传入，避免等待 React state 更新
      if (directSessionId) {
        skipNextLoadRef.current = true;   // 告知 load effect 跳过本次 DB 重读
        sessionIdRef.current = directSessionId; // 立即更新 ref，无需等 useEffect
      }
      const activeSessionId = directSessionId || sessionIdRef.current;
      if (!activeSessionId) return;

      // 兜底：理论上不应该出现"上一个请求还没清理掉就开始新请求"，万一发生先结束它
      if (streamingRef.current) {
        const stalePending = streamingRef.current;
        streamingRef.current = null;
        abortAndPersistPending(stalePending);
      }

      const userMessageId = uuidv4();
      const aiMessageId = uuidv4();
      // 判断"这次回调是否还对应着 hook 当前在追踪的请求"——
      // 避免一个已经被切走/取消的旧请求在竞态情况下反过来覆盖新请求的状态
      const isCurrent = () => streamingRef.current?.messageId === aiMessageId;

      const userMessage = { id: userMessageId, text: input, isUser: true };
      const aiMessage = { id: aiMessageId, text: '', isUser: false };

      dispatchMessages({ type: 'ADD_MESSAGE', payload: userMessage });
      dispatchMessages({ type: 'ADD_MESSAGE', payload: aiMessage });
      await saveMessageToDB(userMessage, activeSessionId);

      setInput('');
      setIsStreaming(true);

      let aiMessageContent = '';
      const abortController = new AbortController();
      streamingRef.current = {
        messageId: aiMessageId,
        sessionId: activeSessionId,
        controller: abortController,
        getContent: () => aiMessageContent,
      };

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
              if (isCurrent()) {
                setIsStreaming(false);
                streamingRef.current = null;
              }

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
              // 通知外部（侧边栏）该会话有更新：刷新排序 / 拾取新标题
              // 即使用户已经切走了，这条已经完整生成的回复也应该正确入库、侧边栏也该更新
              onSessionTouchedRef.current?.();
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
        if (isCurrent()) {
          setIsStreaming(false);
          streamingRef.current = null;
        }
      }
    },
    [currentModel, abortAndPersistPending]
  );

  const cancelChatCompletion = useCallback(() => {
    const pending = streamingRef.current;
    streamingRef.current = null;
    setIsStreaming(false);
    abortAndPersistPending(pending);
  }, [abortAndPersistPending]);

  return {
    messages,
    input,
    setInput,
    isStreaming,
    handleChatCompletion,
    messagesEndRef,
    cancelChatCompletion,
    hasMore,
    isLoadingMore,
    loadMoreMessages,
  };
};
