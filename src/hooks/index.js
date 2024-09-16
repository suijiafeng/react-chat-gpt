import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { generateChatCompletion, createNewChat, generateTitle } from '../apis/chat';
import { checkAuthStatus } from '../apis/auths';
import { userStore } from '../store'

export const useLanguage = () => {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    // 从 localStorage 读取语言设置，如果没有则使用默认语言
    const savedLanguage = localStorage.getItem('appLanguage');
    if (savedLanguage) {
      i18n.changeLanguage(savedLanguage);
    }
  }, [i18n]);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    // 将新的语言设置保存到 localStorage
    localStorage.setItem('appLanguage', lng);
  };

  return {
    t,
    language: i18n.language,
    changeLanguage,
  };
};

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await checkAuthStatus();

        if (res.statusText === "OK") {
          setIsLoggedIn(true);
          userStore.setUser({
            ...res.data
          });
        }
      } catch (error) {
        console.error('Authentication check failed', error);
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  return { isLoggedIn, isLoading };
};

export const useChat = (currentModel) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [controller, setController] = useState(null); // 用于控制请求中止
  const messagesEndRef = useRef(null);

  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    async (input, conversation, onMessageUpdate) => {
      const userMessageId = uuidv4();
      const aiMessageId = uuidv4();

      setMessages((prevMessages) => [
        ...prevMessages,
        { id: userMessageId, text: input, isUser: true },
        { id: aiMessageId, text: '', isUser: false },
      ]);

      setInput("");
      setIsStreaming(true);

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
              generateTitle({ model: currentModel, prompt: '生成对话标题', chat_id: '' });
              setController(null); // 请求完成后清空控制器
              return;
            }

            onMessageUpdate(aiMessageId, chunk);
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
    setMessages((prevMessages) =>
      prevMessages.map((msg) =>
        msg.id === id ? { ...msg, text: msg.text + chunk } : msg
      )
    );
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
  };
};
