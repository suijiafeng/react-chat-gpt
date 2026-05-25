import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { message as antdMessage } from 'antd';
import { v4 as uuidv4 } from 'uuid';
import { generateChatCompletion, generateTitle } from '../apis/chat';
import {
  saveMessageToDB,
  loadMessagesBySessionPaged,
  updateSessionTitle,
  touchSession,
  deleteMessageFromDB,
  deleteMessagesByIds,
} from '../store/db';
import { getConfig } from '../store/llmConfig';
import { trimConversation } from '../utils/context';
import { buildUserContent } from '../utils/attachments';

// 消息落库的兜底封装：写入失败（最常见是 base64 图片撑爆存储配额）时
// 提示用户但不抛出——本地持久化失败不应该中断正在进行的对话流
const persistMessage = async (msg, sessionId) => {
  try {
    await saveMessageToDB(msg, sessionId);
    return true;
  } catch (error) {
    console.error('消息保存到本地失败：', error);
    antdMessage.warning(
      error?.name === 'QuotaExceededError'
        ? '浏览器存储空间不足，本条消息不会保存到历史（可删除旧会话释放空间）'
        : '消息保存到本地失败，刷新后可能丢失本条记录'
    );
    return false;
  }
};

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
    case 'UPDATE_REASONING':
      return state.map((msg) =>
        msg.id === action.id
          ? { ...msg, reasoning: `${msg.reasoning || ''}${action.payload}` }
          : msg
      );
    case 'APPEND_ERROR':
      // 错误文本单独追加一段，并打上 isError 标记供 ChatMessage 做视觉区分——
      // 不和 UPDATE_MESSAGE 共用，避免错误信息被当成模型的正常输出拼接在一起
      return state.map((msg) =>
        msg.id === action.id
          ? {
              ...msg,
              text: msg.text ? `${msg.text}\n\n${action.payload}` : action.payload,
              isError: true,
            }
          : msg
      );
    case 'SET_TEXT':
      // 直接替换整条消息文本（编辑消息 / 重新生成前清空旧回复），
      // 顺带清掉上一次可能残留的错误标记——这条消息正在被重新生成
      return state.map((msg) =>
        msg.id === action.id ? { ...msg, text: action.payload, isError: false } : msg
      );
    case 'REMOVE_MESSAGE':
      return state.filter((msg) => msg.id !== action.id);
    case 'TRUNCATE_AFTER': {
      // 保留到指定消息为止（含），丢弃之后的所有消息——编辑分叉重发时使用
      const idx = state.findIndex((msg) => msg.id === action.id);
      return idx === -1 ? state : state.slice(0, idx + 1);
    }
    case 'CLEAR_HISTORY':
      return [];
    default:
      return state;
  }
};

// 内存中的消息数组 → 发给模型的 role/content 会话格式。
// 用户消息若带图片/文件附件，组装成 OpenAI vision 兼容的 content（数组或注入文件文本）
export const toConversation = (msgs) =>
  msgs.map((msg) =>
    msg.isUser
      ? { role: 'user', content: buildUserContent(msg.text, msg.images, msg.attachments) }
      : { role: 'assistant', content: msg.text }
  );

// 每会话系统提示词注入：非空时前置一条 system 消息。
// trimConversation 会始终保留开头的 system 消息，这里只负责拼装。
export const withSystemPrompt = (conversation, systemPrompt) => {
  const trimmed = (systemPrompt || '').trim();
  if (!trimmed) return conversation;
  return [{ role: 'system', content: trimmed }, ...conversation];
};

export const useChat = (currentModel, sessionId, onSessionTouched, systemPrompt = '') => {
  const [messages, dispatchMessages] = useReducer(messagesReducer, []);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  // 上一次生成被用户手动停止且已有部分内容时为 true，此时展示"继续生成"入口
  const [canContinue, setCanContinue] = useState(false);
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
  // 同上：system prompt 用 ref 镜像，避免它成为 runCompletion 的依赖
  const systemPromptRef = useRef(systemPrompt);
  useEffect(() => {
    systemPromptRef.current = systemPrompt;
  }, [systemPrompt]);

  // 分页及滚动控制相关状态
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // 当前会话是否已完成首次消息加载。
  // 刷新 /c/:id 页面时，在首屏加载完成前不能断言"这是个空会话"，
  // 否则欢迎语和居中输入框会先闪现一下再跳回消息布局（页面抖动）。
  // /new（无 sessionId）没有历史可加载，首帧即视为加载完成——
  // 否则会反过来：输入框先渲染在底部，effect 跑完才跳到居中（同样是抖动）
  const [initialLoaded, setInitialLoaded] = useState(!sessionId);
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
      // interrupted 标记：这条 AI 回复是被中断的半成品。
      // 切回该会话/刷新页面加载历史时，据此恢复"继续生成"入口
      saveMessageToDB(
        { id: pending.messageId, text: partialText, isUser: false, interrupted: true },
        pending.sessionId
      )
        .then(() => touchSession(pending.sessionId))
        .then(() => onSessionTouchedRef.current?.())
        .catch((error) => console.error('Error saving partial message:', error));
    }
  }, []);

  // 是否跟随滚动到底部：用户在生成中主动向上滚动阅读时置 false，
  // 回到底部附近后恢复 true（由 ChatInterface 的滚动监听维护）
  const autoFollowRef = useRef(true);

  // 自动滚动到最新消息
  useEffect(() => {
    if (skipScrollToBottomRef.current) {
      skipScrollToBottomRef.current = false;
      return;
    }
    if (!autoFollowRef.current) return;
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
    // "继续生成"入口只对当前会话的中断有效，切换会话后不再展示
    setCanContinue(false);
  }, [sessionId, abortAndPersistPending]);

  // 当 sessionId 变化时，加载对应会话的消息
  useEffect(() => {
    if (!sessionId) {
      dispatchMessages({ type: 'CLEAR_HISTORY' });
      setHasMore(false);
      setInitialLoaded(true); // /new 没有历史可加载，可以立即展示空状态
      return;
    }
    // 新建会话首次发送时已在内存中持有消息，跳过 DB 重读避免竞态
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      setHasMore(false);
      setInitialLoaded(true);
      return;
    }
    setInitialLoaded(false);
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
        setHasMore(history.length === PAGE_SIZE);
        // 最后一条是被中断的 AI 半成品回复 → 恢复"继续生成"入口
        const last = history[history.length - 1];
        if (last && !last.isUser && last.interrupted && last.text) {
          setCanContinue(true);
        }
      } catch (error) {
        console.error('Error loading initial messages:', error);
      } finally {
        setIsLoadingMore(false);
        setInitialLoaded(true);
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
      setHasMore(olderMessages.length === PAGE_SIZE);
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

  // ──────────────────────────────────────────────
  // 流式请求核心：发送、重新生成、编辑重发、继续生成都复用这一个函数。
  // - conversation：发给模型的完整会话（发送前会做上下文截断）
  // - aiMessageId：本次流式输出写入的 AI 消息（须已存在于 messages state 中）
  // - existingText："继续生成"时传入已有的部分内容，新 chunk 在其后追加
  // - titlePrompt：非空时表示这是会话的首轮对话，结束后自动生成标题
  // ──────────────────────────────────────────────
  const runCompletion = useCallback(
    async ({ conversation, aiMessageId, activeSessionId, existingText = '', titlePrompt = null }) => {
      // 兜底：理论上不应该出现"上一个请求还没清理掉就开始新请求"，万一发生先结束它
      if (streamingRef.current) {
        const stalePending = streamingRef.current;
        streamingRef.current = null;
        abortAndPersistPending(stalePending);
      }

      setIsStreaming(true);
      setCanContinue(false);

      let aiMessageContent = existingText;
      let hadError = false;
      const abortController = new AbortController();
      const { think } = getConfig();
      streamingRef.current = {
        messageId: aiMessageId,
        sessionId: activeSessionId,
        controller: abortController,
        getContent: () => aiMessageContent,
      };
      // 判断"这次回调是否还对应着 hook 当前在追踪的请求"——
      // 避免一个已经被切走/取消的旧请求在竞态情况下反过来覆盖新请求的状态
      const isCurrent = () => streamingRef.current?.messageId === aiMessageId;

      // 节流批量写入 state：模型/演示 provider 是逐字符或逐 token 回调的，
      // 如果每个字符都单独 dispatch 一次，Markdown 渲染层（react-markdown）会在
      // 每次更新时把已累积的全部文本重新解析一遍——文本越长，越到后面单次解析越贵，
      // 总耗时随内容长度呈平方增长，长回复会让页面卡死。
      // 这里把高频的字符级更新合并成固定节奏（约 20 次/秒）的批量更新，
      // dispatch 次数不再随内容长度增长，只随生成耗时增长，从根上避免平方级开销。
      let pendingChunk = '';
      let pendingReasoningChunk = '';
      let flushTimer = null;
      const flushPending = () => {
        flushTimer = null;
        if (pendingReasoningChunk) {
          const toFlush = pendingReasoningChunk;
          pendingReasoningChunk = '';
          dispatchMessages({ type: 'UPDATE_REASONING', id: aiMessageId, payload: toFlush });
        }
        if (pendingChunk) {
          const toFlush = pendingChunk;
          pendingChunk = '';
          dispatchMessages({ type: 'UPDATE_MESSAGE', id: aiMessageId, payload: toFlush });
        }
      };
      const scheduleFlush = () => {
        if (flushTimer) return;
        flushTimer = setTimeout(flushPending, 50);
      };

      // 空闲看门狗：请求发出后若连续一段时间收不到任何新内容（包括还没收到第一个字节），
      // 视为"接口卡住了"，自动中止并展示为错误——而不是让用户对着光标干等，
      // 又不知道是该继续等还是该手动点停止。
      // 用带 reason 的 abort 触发，这样能在下面 catch 里和"用户手动点停止"区分开
      // （手动取消走的是无 reason 的 abort，产生标准 AbortError）。
      const STALL_TIMEOUT_MS = 30000;
      const triggerStallAbort = () =>
        abortController.abort(new DOMException('模型长时间无响应', 'TimeoutError'));
      let stallTimer = setTimeout(triggerStallAbort, STALL_TIMEOUT_MS);
      const resetStallTimer = () => {
        clearTimeout(stallTimer);
        stallTimer = setTimeout(triggerStallAbort, STALL_TIMEOUT_MS);
      };

      try {
        await generateChatCompletion(
          {
            stream: true,
            model: currentModel,
            // 注入每会话 system prompt 后，按 token 预算截断历史
            // （trimConversation 会保留开头的 system 消息）
            messages: trimConversation(withSystemPrompt(conversation, systemPromptRef.current)),
            options: {},
            think,
            session_id: activeSessionId,
            chat_id: activeSessionId,
            id: uuidv4(),
          },
          async (chunk, meta) => {
            if (chunk === '[DONE]') {
              // 请求正常结束，看门狗不用再守了（不重启，直接清掉）
              clearTimeout(stallTimer);

              // 结束前把节流缓冲区里还没落地的最后一小段内容 flush 掉，避免丢字
              if (flushTimer) clearTimeout(flushTimer);
              flushPending();

              if (isCurrent()) {
                setIsStreaming(false);
                streamingRef.current = null;
              }

              // interrupted: false 显式覆盖——"继续生成"补完后清除中断标记
              await persistMessage(
                {
                  id: aiMessageId,
                  text: aiMessageContent,
                  isUser: false,
                  isError: hadError,
                  interrupted: false,
                },
                activeSessionId
              );
              await touchSession(activeSessionId).catch(() => {});

              // 首条对话结束后，自动生成标题
              if (titlePrompt) {
                try {
                  const titleResponse = await generateTitle({
                    model: currentModel,
                    prompt: titlePrompt,
                    chat_id: activeSessionId,
                  });
                  const nextTitle =
                    titleResponse?.data?.title ||
                    titleResponse?.data?.data?.title ||
                    titlePrompt.trim().slice(0, 20);

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

            if (meta?.isError) {
              // 请求已经以错误告终，看门狗不用再守了
              clearTimeout(stallTimer);

              // 错误前先把已缓冲的正常内容 flush 掉，保证两者不会被合并进同一次 dispatch
              if (flushTimer) clearTimeout(flushTimer);
              flushPending();

              hadError = true;
              aiMessageContent = aiMessageContent ? `${aiMessageContent}\n\n${chunk}` : chunk;
              dispatchMessages({ type: 'APPEND_ERROR', id: aiMessageId, payload: chunk });
              return;
            }

            // 收到了正常内容，说明接口没有卡住，重新起算看门狗倒计时
            resetStallTimer();

            if (meta?.isReasoning) {
              pendingReasoningChunk += chunk;
              scheduleFlush();
              return;
            }

            aiMessageContent += chunk;
            pendingChunk += chunk;
            scheduleFlush();
          },
          abortController.signal
        );
      } catch (error) {
        // 请求已经以异常告终（包括看门狗触发的超时中止），不再需要看门狗
        clearTimeout(stallTimer);

        // 无论是被中止还是意外抛错，都把缓冲区里还没上屏的内容 flush 掉，
        // 避免"停止生成"那一刻恰好卡在节流窗口内，界面短暂丢失最后几个字
        if (flushTimer) clearTimeout(flushTimer);
        flushPending();

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

  const handleChatCompletion = useCallback(
    async (input, conversation, directSessionId, extras = {}) => {
      // directSessionId：新建会话时由外部直接传入，避免等待 React state 更新
      if (directSessionId) {
        skipNextLoadRef.current = true; // 告知 load effect 跳过本次 DB 重读
        sessionIdRef.current = directSessionId; // 立即更新 ref，无需等 useEffect
      }
      const activeSessionId = directSessionId || sessionIdRef.current;
      if (!activeSessionId) return;

      // extras.images / extras.attachments：随消息持久化，展示与后续重发都用得到
      const userMessage = {
        id: uuidv4(),
        text: input,
        isUser: true,
        ...(extras.images?.length ? { images: extras.images } : {}),
        ...(extras.attachments?.length ? { attachments: extras.attachments } : {}),
      };
      const aiMessage = { id: uuidv4(), text: '', isUser: false };

      dispatchMessages({ type: 'ADD_MESSAGE', payload: userMessage });
      dispatchMessages({ type: 'ADD_MESSAGE', payload: aiMessage });
      await persistMessage(userMessage, activeSessionId);

      setInput('');

      await runCompletion({
        conversation,
        aiMessageId: aiMessage.id,
        activeSessionId,
        // 首轮对话（会话里只有这一条用户消息）结束后自动生成标题
        titlePrompt: conversation.length === 1 ? input : null,
      });
    },
    [runCompletion]
  );

  // 重新生成最后一条 AI 回复：删掉旧回复，基于同样的上下文重新请求
  const regenerate = useCallback(async () => {
    if (isStreaming) return;
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId || messages.length === 0) return;

    const last = messages[messages.length - 1];
    let aiMessageId;
    let contextMessages;

    if (!last.isUser) {
      // 常规情况：复用这条 AI 消息的 id，清空后重新流式写入
      aiMessageId = last.id;
      contextMessages = messages.slice(0, -1);
      await deleteMessageFromDB(last.id);
      dispatchMessages({ type: 'SET_TEXT', id: last.id, payload: '' });
    } else {
      // 边界情况：最后一条是用户消息（比如上次生成失败），直接补一条 AI 消息
      aiMessageId = uuidv4();
      contextMessages = messages;
      dispatchMessages({ type: 'ADD_MESSAGE', payload: { id: aiMessageId, text: '', isUser: false } });
    }

    await runCompletion({
      conversation: toConversation(contextMessages),
      aiMessageId,
      activeSessionId,
    });
  }, [messages, isStreaming, runCompletion]);

  // 编辑一条已发送的用户消息并分叉重发：
  // 丢弃该消息之后的所有消息（内存 + DB），更新其内容，然后基于新内容重新请求
  const editAndResend = useCallback(
    async (messageId, newText) => {
      if (isStreaming || !newText.trim()) return;
      const activeSessionId = sessionIdRef.current;
      if (!activeSessionId) return;

      const idx = messages.findIndex((msg) => msg.id === messageId);
      if (idx === -1 || !messages[idx].isUser) return;

      // 清掉该消息之后的所有记录（都比它新，必然已加载在内存中）
      const idsAfter = messages.slice(idx + 1).map((msg) => msg.id);
      await deleteMessagesByIds(idsAfter);

      // 更新消息内容（保留原 id 与附件，时间戳刷新为当前，仍排在会话末尾）
      const edited = messages[idx];
      await saveMessageToDB(
        { ...edited, text: newText, isUser: true },
        activeSessionId
      );
      dispatchMessages({ type: 'TRUNCATE_AFTER', id: messageId });
      dispatchMessages({ type: 'SET_TEXT', id: messageId, payload: newText });

      const aiMessage = { id: uuidv4(), text: '', isUser: false };
      dispatchMessages({ type: 'ADD_MESSAGE', payload: aiMessage });

      const conversation = [
        ...toConversation(messages.slice(0, idx)),
        { role: 'user', content: buildUserContent(newText, edited.images, edited.attachments) },
      ];
      await runCompletion({
        conversation,
        aiMessageId: aiMessage.id,
        activeSessionId,
        // 编辑的是会话第一条消息时，重新生成标题
        titlePrompt: idx === 0 ? newText : null,
      });
    },
    [messages, isStreaming, runCompletion]
  );

  // 继续生成：上次被手动停止后，让模型从中断处接着写。
  // 会话以"部分完成的 assistant 消息"结尾发送，新内容追加到同一条消息上。
  const continueGeneration = useCallback(async () => {
    if (isStreaming) return;
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) return;

    const last = messages[messages.length - 1];
    if (!last || last.isUser || !last.text) return;

    await runCompletion({
      conversation: toConversation(messages),
      aiMessageId: last.id,
      activeSessionId,
      existingText: last.text,
    });
  }, [messages, isStreaming, runCompletion]);

  // 删除单条消息（内存 + DB）。生成中不允许删除，避免与流式写入竞态
  const deleteMessage = useCallback(
    async (messageId) => {
      if (isStreaming) return;
      await deleteMessageFromDB(messageId);
      dispatchMessages({ type: 'REMOVE_MESSAGE', id: messageId });
    },
    [isStreaming]
  );

  const cancelChatCompletion = useCallback(() => {
    const pending = streamingRef.current;
    streamingRef.current = null;
    setIsStreaming(false);
    if (pending) {
      if (pending.getContent()) {
        // 有部分内容：保存下来，并允许"继续生成"
        setCanContinue(true);
      } else {
        // 一个字都没生成就停止了：移除空的 AI 消息气泡
        dispatchMessages({ type: 'REMOVE_MESSAGE', id: pending.messageId });
      }
    }
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
    initialLoaded,
    // 消息级交互
    canContinue,
    regenerate,
    editAndResend,
    continueGeneration,
    deleteMessage,
    autoFollowRef,
  };
};
