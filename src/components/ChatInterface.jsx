import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Menu, Sun, Moon, Globe } from "lucide-react";
import Sidebar from '../components/Sidebar';
import ModelSelector from '../components/ModelSelector';
import ChatMessage from '../components/ChatMessage';
import { useTheme } from '../contexts/ThemeContext';
import { useModel } from '../contexts/ModelContext';
import { useLanguage } from '../hooks';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const { isDark, toggleTheme } = useTheme();
  const { currentModel } = useModel();
  const { language, changeLanguage, t } = useLanguage();
  const lastWindowWidth = useRef(window.innerWidth);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      if (currentWidth < 1024 && lastWindowWidth.current >= 1024) {
        setIsSidebarOpen(false);
      } else if (currentWidth >= 1024 && lastWindowWidth.current < 1024) {
        setIsSidebarOpen(true);
      }
      lastWindowWidth.current = currentWidth;
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = useCallback(
    (e) => {
      e.preventDefault();
      if (input.trim()) {
        setMessages((prevMessages) => [
          ...prevMessages,
          { text: input, isUser: true },
        ]);
        setTimeout(() => {
          setMessages((prev) => [
            ...prev,
            {
              text:
                language === "en"
                  ? `This is a simulated response from ${currentModel}.`
                  : `这是来自${currentModel}的模拟回复。`,
              isUser: false,
            },
          ]);
        }, 1000);
        setInput("");
      }
    },
    [input, currentModel, language]
  );

  const toggleSidebar = useCallback(
    () => setIsSidebarOpen((prev) => !prev),
    []
  );

  return (
    <div
      className={`flex h-screen  ${isDark ? "bg-[#212121]" : "bg-white"
        } transition-colors duration-300`}
    >
      <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className={`${isDark ? "bg-[#212121] text-white" : "bg-white text-black"
            } px-4 flex items-center justify-between h-[65px] transition-colors duration-300`}
        >
          <div className="flex items-center">
            <button
              onClick={toggleSidebar}
              className={`${isDark
                ? "text-gray-300 hover:text-white"
                : "text-gray-500 hover:text-gray-700"
                } mr-4 transition-colors duration-200`}
            >
              <Menu size={24} />
            </button>
            <ModelSelector />
          </div>
          <div className="flex items-center">
            <button
              onClick={()=>changeLanguage(language==='zh'?'en':'zh')}
              className={`${isDark
                ? "text-gray-300 hover:text-white"
                : "text-gray-500 hover:text-gray-700"
                } mr-4 transition-colors duration-200 flex items-center w-[45px]`}
            >
              <Globe size={24} />
              {language}
            </button>
            <button
              onClick={toggleTheme}
              className={`${isDark
                ? "text-yellow-300 hover:text-yellow-100"
                : "text-gray-500 hover:text-gray-700"
                } transition-colors duration-200`}
            >
              {isDark ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </div>
        </div>


        <div className={`flex-1 overflow-y-auto`}>
          <div className="max-w-3xl mx-auto p-4 pb-[100px]">
            {messages.map((message, index) => (
              <ChatMessage
                key={index}
                message={message.text}
                isUser={message.isUser}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>


        <div
          className={`${isDark ? "bg-[#212121]" : "bg-white"
            } transition-colors duration-300 bottom-0 left-0 right-0`}
        >
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-4">
            <div className="flex">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className={`flex-1 border rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${isDark
                  ? "bg-[#212121] text-white border-gray-700"
                  : "bg-white text-black border-gray-300"
                  }`}
                placeholder={t("enterMessage")}
              />
              <button
                type="submit"
                className="bg-blue-500 text-white rounded-r-lg px-4 py-2 hover:bg-blue-600 transition-colors duration-200"
              >
                <Send size={24} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface
