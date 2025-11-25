import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, Settings } from "lucide-react";
import { useTheme } from '../contexts/ThemeContext';
import { getModels } from '../apis/models';
import { useAuth } from '../hooks';
import { DEFAULT_LLM_PROVIDER, DEFAULT_LLM_MODEL } from '../constants';
import SettingsModal from './SettingsModal';

const DEMO_MODELS = ['demo-assistant', 'llama3.1:latest'];

const ModelSelector = React.memo(() => {
  const { isDark, classes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { isLoggedIn } = useAuth();
  const [models, setModels] = useState([]);

  const provider = localStorage.getItem('llm_provider') || DEFAULT_LLM_PROVIDER;

  const [currentModel, setCurrentModel] = useState(() => {
    if (provider === 'custom') {
      return localStorage.getItem('llm_model') || DEFAULT_LLM_MODEL;
    }
    return localStorage.getItem('currentModel') || 'demo-assistant';
  });

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);

  const handleModelSelect = useCallback(
    (model) => {
      setCurrentModel(model);
      if (provider === 'custom') {
        localStorage.setItem('llm_model', model);
      } else {
        localStorage.setItem('currentModel', model);
      }
      setIsOpen(false);
    },
    [setCurrentModel, provider]
  );

  useEffect(() => {
    const fetchModels = async () => {
      if (provider === 'custom') {
        const customModel = localStorage.getItem('llm_model') || DEFAULT_LLM_MODEL;
        setModels([customModel, 'gpt-4o', 'gpt-4o-mini', 'deepseek-chat', 'claude-3-5-sonnet']);
        setCurrentModel(customModel);
        return;
      }

      if (localStorage.getItem('demo_mode') === 'true') {
        setModels(DEMO_MODELS);
        setCurrentModel((prevModel) => prevModel || DEMO_MODELS[0]);
        return;
      }

      try {
        const res = await getModels();
        if (res.statusText === "OK") {
          const modelIds = res.data.data.map(item => item.id);
          setModels(modelIds);
          if (modelIds.length > 0) {
            setCurrentModel((prevModel) => prevModel || modelIds[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error);
        // 保留已有的模型列表（如果有），只有在完全没有数据时才回退到演示模型
        setModels((prevModels) => (prevModels.length > 0 ? prevModels : DEMO_MODELS));
        setCurrentModel((prevModel) => prevModel || DEMO_MODELS[0]);
      }
    };
    isLoggedIn && fetchModels();
    // 注意：这里特意不依赖 currentModel —— 上面分支里会 setCurrentModel，
    // 如果把 currentModel 也放进依赖数组，会变成"切换模型 -> 触发本 effect -> 重新拉取模型列表"的多余请求
  }, [isLoggedIn, provider]);

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className={`flex items-center justify-between min-w-[120px] sm:min-w-[160px] px-2.5 sm:px-4 py-2 text-sm ${
          isDark ? 'bg-[#2a2a2a] text-white border-white/10 hover:bg-zinc-800' : 'bg-white text-black border-gray-300 hover:bg-gray-50'
        } border rounded-xl ${classes.themeTransition}`}
      >
        <span className="truncate mr-2 font-medium">{currentModel}</span>
        <ChevronDown
          size={16}
          className={`transform transition-transform duration-200 shrink-0 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-2 min-w-[200px] z-50 transition-colors duration-300 ${
            isDark ? 'bg-[#1e1e1e] text-white border-zinc-800' : 'bg-white text-black border-gray-200'
          } border rounded-2xl shadow-xl ${classes.themeTransition}`}
        >
          <div className="py-1">
            {models.map((model) => (
              <button
                key={model}
                onClick={() => handleModelSelect(model)}
                className={`block w-full text-left px-4 py-2.5 text-sm ${
                  isDark ? "hover:bg-zinc-800" : "hover:bg-gray-50"
                } ${currentModel === model ? "font-bold text-blue-500" : ""}`}
              >
                {model}
              </button>
            ))}
            <div className={`border-t my-1 ${isDark ? 'border-zinc-800' : 'border-gray-100'}`} />
            <button
              onClick={() => {
                setIsOpen(false);
                setIsSettingsOpen(true);
              }}
              className={`flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-blue-500 font-medium ${
                isDark ? "hover:bg-zinc-800" : "hover:bg-gray-50"
              }`}
            >
              <Settings size={14} />
              Configure API / 配置...
            </button>
          </div>
        </div>
      )}

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
});

ModelSelector.displayName = 'ModelSelector';

export default ModelSelector;
