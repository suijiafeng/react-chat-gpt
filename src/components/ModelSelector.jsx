import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import {
  useLlmConfig,
  setCurrentModel,
  setCurrentSelection,
  resolveProviderName,
  resolveCurrentModel,
  DEMO_MODELS,
} from '../store/llmConfig';

const ModelSelector = React.memo(() => {
  const { isDark, classes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // 订阅配置中心：设置弹窗保存后，这里的 provider / 模型列表 / 当前模型即时更新
  const config = useLlmConfig();
  const providerName = resolveProviderName();
  const currentModel = resolveCurrentModel();

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);

  const handleModelSelect = useCallback((model) => {
    setCurrentModel(model);
    setIsOpen(false);
  }, []);

  // 跨服务商选择：切换激活 profile + 模型
  const handleProfileModelSelect = useCallback((profileId, model) => {
    setCurrentSelection(profileId, model);
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
        aria-label={`当前模型 ${currentModel}，点击切换`}
        aria-expanded={isOpen}
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
          className={`absolute right-0 mt-2 w-[224px] max-h-[420px] overflow-y-auto z-50 transition-colors duration-300 ${
            isDark ? 'bg-[#1e1e1e] text-white border-zinc-800' : 'bg-white text-black border-gray-200'
          } border rounded-2xl shadow-xl ${classes.themeTransition}`}
        >
          <div className="py-1">
            <ModelList
              providerName={providerName}
              config={config}
              currentModel={currentModel}
              onSelect={handleModelSelect}
              onProfileSelect={handleProfileModelSelect}
              isDark={isDark}
            />
          </div>
        </div>
      )}
    </div>
  );
});

const ModelItem = ({ model, isActive, onClick, isDark }) => (
  <button
    onClick={onClick}
    className={`flex items-center justify-between w-full text-left px-4 py-2.5 text-sm ${
      isDark ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'
    } ${isActive ? 'font-semibold text-blue-500' : ''}`}
  >
    <span className="truncate">{model}</span>
    {isActive && <Check size={14} className="shrink-0 ml-2" />}
  </button>
);

// 下拉里的模型列表：
// demo → 固定演示模型；
// custom → 按已配置的服务商分组展示，点击任意模型即切换到该服务商；
// backend（服务器托管）→ 后端账号配置的模型列表；
// ollama（后端部署模式）→ 从后端接口拉取，失败时回退到用户配置的列表
const ModelList = ({ providerName, config, currentModel, onSelect, onProfileSelect, isDark }) => {
  const [remoteModels, setRemoteModels] = useState(null);

  // ollama / backend（服务器托管）模式的模型列表来自后端，需异步拉取
  useEffect(() => {
    if (providerName !== 'ollama' && providerName !== 'backend') return;
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

  // custom：按服务商分组展示。每组只列"启用的模型"（设置里勾选的子集，
  // 未勾选 = 全部展示），避免聚合平台上百个模型撑爆下拉
  if (providerName === 'custom') {
    const groups = config.profiles
      .map((p) => ({
        ...p,
        displayModels: p.enabledModels?.length ? p.enabledModels : p.models,
      }))
      .filter((p) => p.displayModels.length > 0);
    if (groups.length === 0) {
      return (
        <div className={`px-4 py-3 text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
          尚未配置模型，请先在设置里添加服务商
        </div>
      );
    }
    return groups.map((profile) => (
      <div key={profile.id}>
        <div
          className={`px-4 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider select-none ${
            isDark ? 'text-zinc-500' : 'text-gray-400'
          }`}
        >
          {profile.name}
        </div>
        {profile.displayModels.map((model) => (
          <ModelItem
            key={`${profile.id}:${model}`}
            model={model}
            isActive={profile.id === config.activeProfileId && currentModel === model}
            onClick={() => onProfileSelect(profile.id, model)}
            isDark={isDark}
          />
        ))}
      </div>
    ));
  }

  const models =
    providerName === 'demo'
      ? DEMO_MODELS
      : providerName === 'backend'
      ? // 优先后端返回的完整列表；拉取失败/未就绪时回退到账号已配置的那一个
        remoteModels || (config.model ? [config.model] : [])
      : remoteModels || config.models;

  if (models.length === 0) {
    return (
      <div className={`px-4 py-3 text-sm ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
        尚未配置模型，请先完成下方配置
      </div>
    );
  }

  return models.map((model) => (
    <ModelItem
      key={model}
      model={model}
      isActive={currentModel === model}
      onClick={() => onSelect(model)}
      isDark={isDark}
    />
  ));
};

ModelSelector.displayName = 'ModelSelector';

export default ModelSelector;
