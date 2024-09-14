import React, {
  useState,
  useRef,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import {
  Send,
  Menu,
  Plus,
  MessageSquare,
  Sun,
  Moon,
  ChevronDown,
  Globe,
  X,
} from "lucide-react";


const ThemeContext = createContext();
const ModelContext = createContext();
const LanguageContext = createContext();


const useTheme = () => useContext(ThemeContext);
const useModel = () => useContext(ModelContext);
const useLanguage = () => useContext(LanguageContext);


const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(false);
  const toggleTheme = useCallback(() => setIsDark((prev) => !prev), []);
  const value = useMemo(() => ({ isDark, toggleTheme }), [isDark, toggleTheme]);
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};


const ModelProvider = ({ children }) => {
  const [currentModel, setCurrentModel] = useState("GPT-3.5");
  const models = useMemo(() => ["GPT-3.5", "GPT-4", "Claude-2", "DALL-E"], []);
  const value = useMemo(
    () => ({ currentModel, setCurrentModel, models }),
    [currentModel, setCurrentModel, models]
  );
  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
};


const translations = {
  en: {
    newChat: "New Chat",
    recentChats: "Recent Chats",
    enterMessage: "Enter your message...",
    send: "Send",
    chat: "Chat",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",
  },
  zh: {
    newChat: "新建聊天",
    recentChats: "最近的聊天",
    enterMessage: "输入您的消息...",
    send: "发送",
    chat: "聊天",
    darkMode: "深色模式",
    lightMode: "浅色模式",
  },
};


const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState("en");
  const toggleLanguage = useCallback(
    () => setLanguage((lang) => (lang === "en" ? "zh" : "en")),
    []
  );
  const t = useMemo(
    () => (key) => translations[language][key],
    [language]
  );
  const value = useMemo(
    () => ({ language, toggleLanguage, t }),
    [language, toggleLanguage, t]
  );
  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};


const ChatMessage = React.memo(({ message, isUser }) => {
  const { isDark } = useTheme();
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`${
          isDark ? "bg-gray-700 text-white" : "bg-gray-200 text-black"
        } rounded-lg px-4 py-2 max-w-[70%] transition-colors duration-300`}
      >
        {message}
      </div>
    </div>
  );
});


const Sidebar = React.memo(({ isOpen, onClose }) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  return (
    <div
      className={`fixed lg:relative top-0 left-0 h-full border-r shadow-md ${
        isDark
          ? "bg-[#171717] text-white border-gray-700"
          : "bg-white text-black border-gray-200"
      } transition-all duration-300 ease-in-out ${
        isOpen ? "w-64" : "w-0"
      } overflow-hidden z-50`}
    >
      <div className="w-64">
        <div className="px-4 flex justify-between h-[65px] items-center">
          <h2 className="text-xl font-bold">ChatGPT</h2>
          <button
            onClick={onClose}
            className={`${
              isDark
                ? "text-gray-300 hover:text-white"
                : "text-gray-500 hover:text-gray-700"
            } mr-4 transition-colors duration-200 lg:hidden`}
          >
            <X size={24} />
          </button>
        </div>
        <div className="px-4">
          <button
            className={`flex items-center ${
              isDark
                ? "text-white hover:bg-[#212121]"
                : "text-black hover:bg-gray-200"
            } w-full p-2 rounded transition-colors duration-200`}
          >
            <Plus size={18} className="mr-2" />
            {t("newChat")}
          </button>
        </div>
        <div className="p-4">
          <div
            className={`text-sm ${
              isDark ? "text-gray-400" : "text-gray-600"
            } mb-2`}
          >
            {t("recentChats")}
          </div>
          {[1, 2].map((chat) => (
            <button
              key={chat}
              className={`flex items-center ${
                isDark
                  ? "text-white hover:bg-[#212121]"
                  : "text-black hover:bg-gray-200"
              } w-full p-2 rounded transition-colors duration-200`}
            >
              <MessageSquare size={18} className="mr-2" />
              {t("chat")} {chat}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});


const ModelSelector = React.memo(() => {
  const { isDark } = useTheme();
  const { currentModel, setCurrentModel, models } = useModel();
  const [isOpen, setIsOpen] = useState(false);

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);
  const handleModelSelect = useCallback(
    (model) => {
      setCurrentModel(model);
      setIsOpen(false);
    },
    [setCurrentModel]
  );

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className={`flex items-center justify-between w-40 px-4 py-2 ${
          isDark ? "bg-[#212121] text-white" : "bg-white text-black"
        } border ${
          isDark ? "border-gray-700" : "border-gray-300"
        } rounded-md transition-colors duration-200`}
      >
        {currentModel}
        <ChevronDown
          size={20}
          className={`transform transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`absolute mt-1 w-40 ${
          isDark ? "bg-[#212121] text-white" : "bg-white text-black"
        } border ${
          isDark ? "border-gray-700" : "border-gray-300"
        } rounded-md shadow-lg transition-opacity duration-200 ${
          isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      >
        {models.map((model) => (
          <button
            key={model}
            onClick={() => handleModelSelect(model)}
            className={`block w-full text-left px-4 py-2 ${
              isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
            } ${currentModel === model ? "font-bold" : ""} transition-colors duration-200`}
          >
            {model}
          </button>
        ))}
      </div>
    </div>
  );
});

const ChatGPTUI = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 1024);
  const { isDark, toggleTheme } = useTheme();
  const { currentModel } = useModel();
  const { language, toggleLanguage, t } = useLanguage();
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
      className={`flex h-screen  ${
        isDark ? "bg-[#212121]" : "bg-white"
      } transition-colors duration-300`}
    >
      <Sidebar isOpen={isSidebarOpen} onClose={toggleSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className={`${
            isDark ? "bg-[#212121] text-white" : "bg-white text-black"
          } px-4 flex items-center justify-between h-[65px] transition-colors duration-300`}
        >
          <div className="flex items-center">
            <button
              onClick={toggleSidebar}
              className={`${
                isDark
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
              onClick={toggleLanguage}
              className={`${
                isDark
                  ? "text-gray-300 hover:text-white"
                  : "text-gray-500 hover:text-gray-700"
              } mr-4 transition-colors duration-200`}
            >
              <Globe size={24} />
            </button>
            <button
              onClick={toggleTheme}
              className={`${
                isDark
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
          className={`${
            isDark ? "bg-[#212121]" : "bg-white"
          } transition-colors duration-300 bottom-0 left-0 right-0`}
        >
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto p-4">
            <div className="flex">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className={`flex-1 border rounded-l-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200 ${
                  isDark
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


const App = () => (
  <ThemeProvider>
    <ModelProvider>
      <LanguageProvider>
        <ChatGPTUI />
      </LanguageProvider>
    </ModelProvider>
  </ThemeProvider>
);

export default App;
