import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Menu, Sun, Moon, Globe } from "lucide-react";
import Sidebar from '../components/Sidebar';
import ModelSelector from '../components/ModelSelector';
import ChatMessage from '../components/ChatMessage';
import NavHeader from "./NavHeader";
import { useTheme } from '../contexts/ThemeContext';
import { useModel } from '../contexts/ModelContext';
import { useLanguage } from '../hooks';
const ChatHeader = ({ toggleSidebar }) => {
  
  const theme = useTheme();
  return (
    <div className={` px-4 flex items-center justify-between h-[65px]`}>
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className={`${theme.buttonText} ${theme.buttonHover} mr-4 transition-colors duration-200`}
        >
          <Menu size={24} />
        </button>
        <ModelSelector />
      </div>
      <NavHeader />
    </div>
  );
};
const ChatInput = ({ input, setInput, handleSubmit }) => {  
  const theme = useTheme();
  const { t } = useLanguage();
  return (
    <div className={`transition-colors duration-300 bottom-0 left-0 right-0`}>
      <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-4">
        <div className="flex">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className={`flex-1 border rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:border-gray-700 transition-colors duration-200 ${
              theme.input}`}
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
  );
};

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const theme = useTheme();
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
    <div className={`flex h-screen ${theme.bg} ${theme.text}transition-colors duration-300`}>
    <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar}/>
    <div className="flex-1 flex flex-col overflow-hidden">
      <ChatHeader toggleSidebar={toggleSidebar} />

      <div className="flex-1 overflow-y-auto">
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

      <ChatInput input={input} setInput={setInput} handleSubmit={handleSubmit} />
    </div>
  </div>
  );
};

export default ChatInterface
