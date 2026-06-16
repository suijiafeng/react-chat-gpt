import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, Search, Settings } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import SettingsModal from './SettingsModal';
import { useLanguage } from '../hooks';
import {
  useLlmConfig,
  setCurrentModel,
  setCurrentSelection,
  resolveProviderName,
  resolveCurrentModel,
  DEMO_MODELS,
} from '../store/llmConfig';

// 服务商分组前的小圆点颜色：按服务商名字哈希出一个固定色相，
// 同一服务商每次打开颜色都一致，纯视觉区分，不需要额外配置或存储
const hueOf = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
};
const dotColor = (str) => `hsl(${hueOf(str)}, 62%, 58%)`;

const ModelSelector = React.memo(() => {
  const { isDark, classes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  // 模型与 API 配置弹窗：入口在下拉面板顶部，与模型搜索同一行
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const containerRef = useRef(null);

  // 订阅配置中心：设置弹窗保存后，这里的 provider / 模型列表 / 当前模型即时更新
  const config = useLlmConfig();
  const providerName = resolveProviderName();
  const currentModel = resolveCurrentModel();

  const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);

  const handleOpenSettings = useCallback(() => {
    setIsOpen(false);
    setIsSettingsOpen(true);
  }, []);

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
        title={currentModel}
        /* 限宽：模型 id 可以很长（含日期/版本后缀），不限制会把顶栏撑变形，
           超出部分由内部 truncate 省略，hover 看完整名 */
        className={`flex items-center justify-between min-w-[128px] sm:min-w-[168px] max-w-[180px] sm:max-w-[240px] px-3 sm:px-4 py-2 text-base leading-5 ${
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
          /* 面板右对齐按钮：按钮限宽后若仍从左边缘展开，260px 的面板会顶出视口右侧 */
          className={`absolute right-0 mt-2 w-[260px] max-w-[calc(100vw-24px)] max-h-[440px] flex flex-col z-50 transition-colors duration-300 ${
            isDark ? 'bg-[#1e1e1e] text-white border-zinc-800' : 'bg-white text-black border-gray-200'
          } border rounded-2xl shadow-xl overflow-hidden ${classes.themeTransition}`}
        >
          <ModelList
            providerName={providerName}
            config={config}
            currentModel={currentModel}
            onSelect={handleModelSelect}
            onProfileSelect={handleProfileModelSelect}
            isDark={isDark}
            onOpenSettings={handleOpenSettings}
          />
        </div>
      )}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
});

const ModelItem = ({ model, isActive, onClick, isDark }) => (
  <button
    onClick={onClick}
    className={`flex min-h-[36px] w-full items-center justify-between text-left px-3 py-2 mb-1 last:mb-0 text-base leading-5 rounded-lg transition-colors duration-150 ${
      isActive
        ? isDark
          ? 'bg-blue-500/15 text-blue-300 font-medium'
          : 'bg-blue-50 text-blue-600 font-medium'
        : isDark
        ? 'text-zinc-200 hover:bg-white/5'
        : 'text-gray-700 hover:bg-black/[0.035]'
    }`}
  >
    <span className="truncate">{model}</span>
    {isActive && <Check size={14} className="shrink-0 ml-2" />}
  </button>
);

// 分组标题：服务商名 + 哈希色小圆点，组间用细分割线区隔，层次更清晰。
// 每组是独立的 wrapper div，GroupLabel 在自己容器里恒为第一个子元素，
// 不能靠 Tailwind 的 first: 伪类判断"是不是列表里第一组"，要靠显式 first 参数
const GroupLabel = ({ name, isDark, first }) => (
  <div
    className={`px-1 pb-2 flex items-center gap-2 ${
      first ? 'pt-0' : `pt-3 mt-2 border-t ${isDark ? 'border-white/[0.06]' : 'border-black/[0.05]'}`
    }`}
  >
    <span className={`text-sm font-semibold uppercase tracking-wider select-none truncate ${
      isDark ? 'text-zinc-500' : 'text-gray-400'
    }`}>
      {name}
    </span>
  </div>
);

const EmptyHint = ({ isDark, children }) => (
  <div className={`px-3 py-4 text-base text-center ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
    {children}
  </div>
);

// 下拉里的模型列表：
// demo → 固定演示模型；
// custom → 按已配置的服务商分组展示，点击任意模型即切换到该服务商；
// backend（服务器托管）→ 后端账号配置的模型列表；
// ollama（后端部署模式）→ 从后端接口拉取，失败时回退到用户配置的列表
const ModelList = ({ providerName, config, currentModel, onSelect, onProfileSelect, isDark, onOpenSettings }) => {
  const { t } = useLanguage();
  const [remoteModels, setRemoteModels] = useState(null);
  const [query, setQuery] = useState('');

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

  // custom：按服务商分组展示。每组只列"启用的模型"（设置里勾选的子集）；
  // 全部取消勾选的服务商整组隐藏，保持切换列表干净
  const customGroups = useMemo(() => {
    if (providerName !== 'custom') return null;
    return config.profiles
      .map((p) => ({ ...p, displayModels: p.enabledModels || [] }))
      .filter((p) => p.displayModels.length > 0);
  }, [providerName, config.profiles]);

  const flatModels = useMemo(() => {
    if (providerName === 'custom') return null;
    if (providerName === 'demo') return DEMO_MODELS;
    if (providerName === 'backend') {
      // 优先后端返回的完整列表；拉取失败/未就绪时回退到账号已配置的那一个
      return remoteModels || (config.model ? [config.model] : []);
    }
    return remoteModels || config.models;
  }, [providerName, remoteModels, config.model, config.models]);

  // 搜索框常驻：曾按"模型多于 8 个才显示"做过降噪，实际反而让用户找不到搜索入口，
  // 且面板头布局会随模型数量变化跳动，得不偿失

  const q = query.trim().toLowerCase();
  const filteredGroups = customGroups
    ?.map((g) => ({
      ...g,
      displayModels: q
        ? g.displayModels.filter(
            (m) => m.toLowerCase().includes(q) || g.name.toLowerCase().includes(q)
          )
        : g.displayModels,
    }))
    .filter((g) => g.displayModels.length > 0);
  const filteredFlat = q
    ? flatModels?.filter((m) => m.toLowerCase().includes(q))
    : flatModels;

  const body = (() => {
    if (providerName === 'custom') {
      if (!customGroups || customGroups.length === 0) {
        return <EmptyHint isDark={isDark}>{t('noModelsCustom')}</EmptyHint>;
      }
      if (!filteredGroups || filteredGroups.length === 0) {
        return <EmptyHint isDark={isDark}>{t('noMatchModels')}</EmptyHint>;
      }
      return filteredGroups.map((profile, idx) => (
        <div key={profile.id}>
          <GroupLabel name={profile.name} isDark={isDark} first={idx === 0} />
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

    if (!flatModels || flatModels.length === 0) {
      return <EmptyHint isDark={isDark}>{t('noModelsFlat')}</EmptyHint>;
    }
    if (!filteredFlat || filteredFlat.length === 0) {
      return <EmptyHint isDark={isDark}>{t('noMatchModels')}</EmptyHint>;
    }
    return filteredFlat.map((model) => (
      <ModelItem
        key={model}
        model={model}
        isActive={currentModel === model}
        onClick={() => onSelect(model)}
        isDark={isDark}
      />
    ));
  })();

  return (
    <>
      {/* 面板头：模型搜索框（常驻）与「模型与 API 配置」入口保持一行 */}
      <div
        className={`sticky top-0 z-10 px-3 py-2 border-b flex items-center gap-2 ${
          isDark ? 'bg-[#1e1e1e] border-white/[0.06]' : 'bg-white border-black/[0.05]'
        }`}
      >
        <div
          className={`flex flex-1 min-w-0 items-center gap-2 rounded-lg px-3 py-2 ${
            isDark ? 'bg-white/5' : 'bg-black/[0.035]'
          }`}
        >
          <Search size={13} className={isDark ? 'text-zinc-500' : 'text-gray-400'} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchModels')}
            className={`w-full bg-transparent text-base outline-none ${
              isDark ? 'text-white placeholder:text-zinc-600' : 'text-black placeholder:text-gray-400'
            }`}
          />
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          title={t('settings')}
          aria-label={t('settings')}
          className={`shrink-0 rounded-lg p-2 transition-colors duration-150 ${
            isDark ? 'text-zinc-400 hover:bg-white/10 hover:text-white' : 'text-gray-500 hover:bg-black/5 hover:text-gray-800'
          }`}
        >
          <Settings size={16} />
        </button>
      </div>
      <div className="px-2 py-2 overflow-y-auto">{body}</div>
    </>
  );
};

ModelSelector.displayName = 'ModelSelector';

export default ModelSelector;
