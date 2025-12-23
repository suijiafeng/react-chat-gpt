import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import {
  useLlmConfig,
  setCurrentModel,
  resolveProviderName,
  resolveCurrentModel,
  DEMO_MODELS,
} from '../store/llmConfig';

const ModelSelector = React.memo(() => {
  const { isDark, classes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // 订阅配置中心：设置弹窗保存后，这里的 provider / 模型列表 / 当前模型即时更新
  useLlmConfig();
  const providerName = resolveProviderName();
  const currentModel = resolveCurrentModel();

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);

  const handleModelSelect = useCallback((model) => {
    setCurrentModel(model);
    setIsOpen(false);
  }, []);

  // 点击组件外部时收起下拉
  useEffect(() => {
    if (!isOpen) return;
    const onClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={toggleOpen}
        className={`flex items-center justify-between min-w-[120px] sm:min-w-[160px] px-2.5 sm:px-4 py-2 text-sm ${
          isDark ? 'bg-[#2a2a2a] text-white border-white/10 hover:bg-zinc-800' : 'bg-white text-black border-gray-300 hover:bg-gray-50'
        } border rounded-xl ${classes.themeTransition}`}
      >
        <span className="truncate mr-2 font-medium">{currentModel}</span>
        <ChevronDown
          size={16}
          className={`transform transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 mt-2 min-w-[220px] max-h-[60vh] overflow-y-auto z-50 transition-colors duration-300 ${
            isDark ? 'bg-[#1e1e1e] text-white border-zinc-800' : 'bg-white text-black border-gray-200'
          } border rounded-2xl shadow-xl ${classes.themeTransition}`}
        >
          <div className="py-1">
            <ModelList
              providerName={providerName}
              currentModel={currentModel}
              onSelect={handleModelSelect}
              isDark={isDark}
            />
          </div>
        </div>
      )}
    </div>
  );
});

// 下拉里的模型列表：
// demo → 固定演示模型；custom → 用户在设置里维护的列表；
// ollama（后端部署模式）→ 从后端接口拉取，失败时回退到用户配置的列表
const ModelList = ({ providerName, currentModel, onSelect, isDark }) => {
  const config = useLlmConfig();
  const [remoteModels, setRemoteModels] = useState(null);

  useEffect(() => {
    if (providerName !== 'ollama') return;
    let cancelled = false;
    import('../apis/models').then(({ getModels }) =>
      getModels()
        .then((res) => {
          const ids = (res?.data?.data || []).map((m) => m.id).filter(Boolean);
          if (!cancelled && ids.length) setRemoteModels(ids);
        })
        .catch(() => {})
    );
    return () => {
      cancelled = true;
    };
  }, [providerName]);

  const models =
    providerName === 'demo' ? DEMO_MODELS : remoteModels || config.models;

  if (models.length === 0) {
    return (
      <div className={`px-4 py-3 text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
        尚未配置模型，请先完成下方配置
      </div>
    );
  }

  return models.map((model) => (
    <button
      key={model}
      onClick={() => onSelect(model)}
      className={`flex items-center justify-between w-full text-left px-4 py-2.5 text-sm ${
        isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'
      } ${currentModel === model ? 'font-semibold text-blue-500' : ''}`}
    >
      <span className="truncate">{model}</span>
      {currentModel === model && <Check size={14} className="shrink-0 ml-2" />}
    </button>
  ));
};

ModelSelector.displayName = 'ModelSelector';

export default ModelSelector;
