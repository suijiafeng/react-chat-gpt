import { useState, useEffect, useRef } from 'react';
import { Modal, Input, Radio, Button, Select, InputNumber, Switch, message, Popconfirm } from 'antd';
import { Zap, CheckCircle2, XCircle, Loader2, ServerCog, Server, Bot, Sparkles, Trash2, Plus, ExternalLink, GripVertical } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
import { getConfig, saveConfig, saveProfiles } from '../store/llmConfig';
import { getBackendLlmConfig, saveBackendLlmConfig, testBackendLlmConfig } from '../apis/llm';
import { USE_LOCAL_DATA } from '../constants';
import { PROVIDER_PRESETS } from '../constants/providerPresets';

// 从任意 OpenAI 兼容平台拉取模型 id 列表（浏览器直连，用于 custom 模式）。
const fetchOpenAiModelIds = async (baseUrl, apiKey) => {
  const base = baseUrl.trim().replace(/\/+$/, '');
  const headers = {};
  if (apiKey.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  const res = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return (data?.data || []).map((m) => m.id).filter(Boolean);
};

// "测试连接"按钮 + 结果文案（custom / backend 两个分区共用同一套外观与状态图标）
const TestConnection = ({ onTest, state, message: msg, disabled, isDark, classes, successCls, errorCls }) => (
  <>
    <Button
      onClick={onTest}
      disabled={disabled || state === 'testing'}
      icon={
        state === 'testing' ? <Loader2 size={14} className="animate-spin inline" />
        : state === 'ok' ? <CheckCircle2 size={14} className="inline text-green-500" />
        : state === 'fail' ? <XCircle size={14} className="inline text-red-500" />
        : <Zap size={14} className="inline" />
      }
      className={`rounded-xl flex items-center gap-1.5 ${classes.themeTransition} ${
        isDark ? 'bg-[#121212] text-white border-white/10 hover:bg-white/5' : 'border-slate-200 text-slate-700'
      }`}
    >
      {state === 'testing' ? '测试中...' : '测试连接'}
    </Button>
    {msg && <p className={`text-xs ${state === 'ok' ? successCls : errorCls}`}>{msg}</p>}
  </>
);

let customSeq = 0;
const newCustomId = () => `custom-${Date.now()}-${customSeq++}`;

// 服务商卡片的显示顺序是纯 UI 偏好，独立于 profiles 数据本身持久化，
// 拖拽调整后立即写入，不需要走"保存"按钮
const CHIP_ORDER_KEY = 'llm_provider_chip_order';
const loadChipOrder = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(CHIP_ORDER_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
};
const saveChipOrder = (order) => localStorage.setItem(CHIP_ORDER_KEY, JSON.stringify(order));

const SettingsModal = ({ isOpen, onClose }) => {
  const { isDark, classes } = useTheme();
  const { t } = useLanguage();

  const [provider, setProvider] = useState('demo');
  // 多服务商 profile 列表（apiKey 为明文，保存时由配置中心统一编码）
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [contextTokens, setContextTokens] = useState(8000);
  const [think, setThink] = useState(false);
  // 连接测试状态：idle | testing | ok | fail
  const [testState, setTestState] = useState('idle');
  const [testMessage, setTestMessage] = useState('');
  const [modelsAutoLoading, setModelsAutoLoading] = useState(false);
  // 本次会话中用户主动清空过启用勾选的 profile——自动拉取不再替它默认补选
  const clearedEnabledRef = useRef(new Set());
  // 记录每个 profile 上一次自动拉取用的「地址|密钥」签名，避免同样的值重复请求
  const lastFetchSigRef = useRef(new Map());

  // 服务商卡片的拖拽显示顺序：id 列表，内置预设 + 自定义 profile 混排
  const [chipOrder, setChipOrder] = useState(loadChipOrder);
  const [dragOverId, setDragOverId] = useState(null);
  const dragIdRef = useRef(null);

  // "服务器托管"模式专用状态：配置存在后端账号下，不进 localStorage
  const [backendApiUrl, setBackendApiUrl] = useState('');
  const [backendApiKey, setBackendApiKey] = useState('');
  const [backendModel, setBackendModel] = useState('');
  const [backendProvider, setBackendProvider] = useState('custom'); // custom=OpenAI 兼容 | ollama=原生
  const [backendHasApiKey, setBackendHasApiKey] = useState(false);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendLoadError, setBackendLoadError] = useState('');
  const [backendTestState, setBackendTestState] = useState('idle');
  const [backendTestMessage, setBackendTestMessage] = useState('');
  const backendModelEditedRef = useRef(false);
  const lastBackendFetchRef = useRef('');

  const selected = profiles.find((p) => p.id === selectedId) || null;

  // 表单里的 key（新输入）为空时，取配置中心内存缓存里的已存明文——
  // 测试连接 / 自动拉模型需要真实 key，但它不进入表单、不渲染到 DOM
  const effectiveKey = (profile) =>
    (profile.apiKey || '').trim() ||
    (profile.hasApiKey
      ? getConfig().profiles.find((p) => p.id === profile.id)?.apiKey || ''
      : '');

  // 打开弹窗时从配置中心加载当前值
  useEffect(() => {
    if (!isOpen) return;
    const config = getConfig();
    setProvider(
      config.provider === 'custom' || config.provider === 'backend' ? config.provider : 'demo'
    );
    // 安全：表单不回填明文 key（避免暴露在 DOM/开发者工具里）。
    // apiKey 置空 + hasApiKey 标记"已保存"；留空保存 = 沿用旧值
    setProfiles(
      config.profiles.map((p) => ({
        ...p,
        apiKey: '',
        hasApiKey: Boolean(p.hasApiKey || p.apiKey),
        models: [...p.models],
        enabledModels: [...(p.enabledModels || [])],
      }))
    );
    setSelectedId(config.activeProfileId || config.profiles[0]?.id || '');
    setContextTokens(config.contextTokens);
    setThink(config.think);
    setTestState('idle');
    setTestMessage('');
    setBackendLoadError('');
    lastFetchSigRef.current = new Map();
    backendModelEditedRef.current = false;
    lastBackendFetchRef.current = '';

    // 服务器托管模式的配置存在后端，需要单独拉取（依赖登录 session）
    if (!USE_LOCAL_DATA) {
      setBackendLoading(true);
      setBackendTestState('idle');
      setBackendTestMessage('');
      getBackendLlmConfig()
        .then((res) => {
          setBackendApiUrl(res.data?.apiUrl || '');
          setBackendModel(res.data?.model || '');
          setBackendProvider(res.data?.provider === 'ollama' ? 'ollama' : 'custom');
          setBackendHasApiKey(Boolean(res.data?.hasApiKey));
          setBackendApiKey('');
          backendModelEditedRef.current = Boolean(res.data?.model);
        })
        .catch((error) => {
          setBackendLoadError(
            error.response?.status === 401
              ? '请先登录后再配置服务器托管模式'
              : '加载后端配置失败：' + (error.response?.data?.message || error.message)
          );
        })
        .finally(() => setBackendLoading(false));
    }
  }, [isOpen]);

  // 服务商卡片显示顺序：内置预设 + 当前已配置的自定义 profile 的并集，
  // 沿用上次拖拽保存的顺序，新出现的 id（新增自定义 profile）追加到末尾
  useEffect(() => {
    const allIds = [
      ...PROVIDER_PRESETS.map((p) => p.id),
      ...profiles
        .filter((p) => !PROVIDER_PRESETS.some((preset) => preset.id === p.id))
        .map((p) => p.id),
    ];
    setChipOrder((prev) => {
      const known = prev.filter((id) => allIds.includes(id));
      const missing = allIds.filter((id) => !known.includes(id));
      return [...known, ...missing];
    });
  }, [profiles]);

  const reorderChips = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    setChipOrder((prev) => {
      const next = prev.filter((id) => id !== fromId);
      const idx = next.indexOf(toId);
      next.splice(idx === -1 ? next.length : idx, 0, fromId);
      saveChipOrder(next);
      return next;
    });
  };

  // 更新当前选中 profile 的字段
  const updateSelected = (patch) => {
    setProfiles((prev) => prev.map((p) => (p.id === selectedId ? { ...p, ...patch } : p)));
  };

  // 点击预设：已配置过该平台则切换过去，否则新建一个 profile
  const applyPreset = (preset) => {
    const existing = profiles.find((p) => p.id === preset.id);
    if (existing) {
      setSelectedId(existing.id);
    } else {
      const profile = {
        id: preset.id,
        name: preset.name,
        apiUrl: preset.apiUrl,
        apiKey: '',
        models: [...preset.fallbackModels],
        // 默认勾选第一个（预设把最新/主打模型排在最前）
        enabledModels: preset.fallbackModels.slice(0, 1),
        model: preset.fallbackModels[0],
      };
      setProfiles((prev) => [...prev, profile]);
      setSelectedId(preset.id);
    }
    setTestState('idle');
    setTestMessage('');
  };

  // 新建一个空白的自定义服务商（最多 10 个自定义服务商）
  const addCustomProfile = () => {
    const customCount = profiles.filter((p) => !PROVIDER_PRESETS.some((preset) => preset.id === p.id)).length;
    if (customCount >= 10) {
      message.warning('最多支持 10 个自定义服务商');
      return;
    }
    const id = newCustomId();
    setProfiles((prev) => [
      ...prev,
      { id, name: '自定义服务商', apiUrl: '', apiKey: '', models: [], model: '' },
    ]);
    setSelectedId(id);
    setTestState('idle');
    setTestMessage('');
  };

  const removeSelected = () => {
    setProfiles((prev) => {
      const next = prev.filter((p) => p.id !== selectedId);
      setSelectedId(next[0]?.id || '');
      return next;
    });
    setTestState('idle');
    setTestMessage('');
  };

  // 把拉取到的模型 id 列表写入选中 profile（最多 200 个，作为勾选候选项）。
  // 用户手输的自定义模型名不在拉取结果里也保留；fillDefault=true（手动测试连接导入）
  // 且勾选为空时默认补选第一个——自动防抖拉取不补，尊重用户显式清空
  const applyFetchedModels = (ids, fillDefault = false) => {
    const list = ids.slice(0, 200);
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== selectedId) return p;
        let enabled = p.enabledModels || [];
        if (!enabled.length && fillDefault) enabled = list.slice(0, 1);
        return {
          ...p,
          models: [...new Set([...list, ...enabled])],
          enabledModels: enabled,
          model: enabled.includes(p.model) ? p.model : enabled[0] || list[0],
        };
      })
    );
  };

  // 手动"测试连接"：显式请求 {base}/models 验证地址/密钥，并导入模型列表
  const handleTest = async () => {
    if (!selected) return;
    setTestState('testing');
    setTestMessage('');
    try {
      const ids = await fetchOpenAiModelIds(selected.apiUrl, effectiveKey(selected));
      setTestState('ok');
      if (ids.length > 0) {
        setTestMessage(`连接成功，检测到 ${ids.length} 个可用模型`);
        applyFetchedModels(ids, true);
        lastFetchSigRef.current.set(selected.id, selected.apiUrl.trim() + '|' + selected.apiKey.trim());
      } else {
        setTestMessage('连接成功');
      }
    } catch (error) {
      setTestState('fail');
      // 部分平台的 /models 接口有 CORS 限制，测试失败不代表对话一定不可用
      setTestMessage(`连接失败：${error.message}（部分平台限制浏览器直接访问，可忽略并直接保存试用）`);
    }
  };

  // 自动拉取模型：填好地址（+密钥）后防抖自动请求 /models 生成勾选候选，
  // 让预设不会因为模型下线而过时；手输项通过并集保留，失败静默。
  useEffect(() => {
    if (provider !== 'custom' || !selected) return;
    const base = selected.apiUrl?.trim();
    if (!base) return;
    const sig = base + '|' + (selected.apiKey || '').trim();
    if (sig === lastFetchSigRef.current.get(selected.id)) return;

    const timer = setTimeout(async () => {
      setModelsAutoLoading(true);
      try {
        const ids = await fetchOpenAiModelIds(selected.apiUrl, effectiveKey(selected));
        lastFetchSigRef.current.set(selected.id, sig);
        if (ids.length) {
          // 用户没主动清空过勾选时，空勾选默认补选第一个（最新）
          applyFetchedModels(ids, !clearedEnabledRef.current.has(selected.id));
          setTestState('ok');
          setTestMessage(`已自动获取 ${ids.length} 个模型`);
        }
      } catch {
        // 静默失败：多因平台限制浏览器跨域访问 /models，保留预设兜底，用户可手动"测试连接"
        lastFetchSigRef.current.set(selected.id, sig);
      } finally {
        setModelsAutoLoading(false);
      }
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, selectedId, selected?.apiUrl, selected?.apiKey]);

  // 自动拉取模型：backend 模式下由服务端拉取（绕开浏览器 CORS），填好地址后防抖触发，
  // 仅在用户还没填模型名时自动填充。
  useEffect(() => {
    if (provider !== 'backend' || USE_LOCAL_DATA) return;
    const base = backendApiUrl.trim();
    if (!base || backendLoading || backendModelEditedRef.current) return;
    const sig = base + '|' + backendApiKey.trim();
    if (sig === lastBackendFetchRef.current) return;

    const timer = setTimeout(async () => {
      try {
        const res = await testBackendLlmConfig({ apiUrl: base, apiKey: backendApiKey.trim() });
        lastBackendFetchRef.current = sig;
        const ids = (res.data?.data || []).map((m) => m.id).filter(Boolean);
        if (ids.length && !backendModelEditedRef.current) {
          setBackendModel((prev) => (ids.includes(prev) ? prev : ids[0]));
          setBackendTestState('ok');
          setBackendTestMessage(`已自动获取 ${ids.length} 个模型`);
        }
      } catch {
        lastBackendFetchRef.current = sig; // 静默，用户可手动点"测试连接"看具体错误
      }
    }, 900);
    return () => clearTimeout(timer);
  }, [provider, backendApiUrl, backendApiKey, backendLoading]);

  // 后端模式连接测试：让服务端用当前表单里的地址/密钥去拉模型列表（绕开浏览器 CORS）。
  const handleBackendTest = async () => {
    if (!backendApiUrl.trim()) {
      message.warning('请先填写 API 接口地址');
      return;
    }
    setBackendTestState('testing');
    setBackendTestMessage('');
    try {
      const res = await testBackendLlmConfig({
        apiUrl: backendApiUrl.trim(),
        apiKey: backendApiKey.trim(),
      });
      const ids = (res.data?.data || []).map((m) => m.id).filter(Boolean);
      setBackendTestState('ok');
      if (ids.length > 0) {
        setBackendTestMessage(`连接成功，检测到 ${ids.length} 个可用模型`);
        setBackendModel((prev) => (ids.includes(prev) ? prev : ids[0]));
      } else {
        setBackendTestMessage('连接成功');
      }
    } catch (error) {
      setBackendTestState('fail');
      setBackendTestMessage('连接失败：' + (error.response?.data?.message || error.message));
    }
  };

  const handleSave = async () => {
    if (provider === 'custom') {
      // 只保存填写了地址的 profile；当前选中的必须配置完整
      const validProfiles = profiles
        .map((p) => ({ ...p, models: (p.models || []).map((m) => m.trim()).filter(Boolean) }))
        .filter((p) => p.apiUrl?.trim());
      if (validProfiles.length === 0) {
        message.warning('请至少配置一个服务商（填写 API 接口地址）');
        return;
      }
      const active =
        validProfiles.find((p) => p.id === selectedId) || validProfiles[0];
      if (active.models.length === 0) {
        message.warning(`请为「${active.name}」至少添加一个模型`);
        return;
      }
      // 规范每个 profile：key 留空沿用旧值；默认模型取启用列表第一个
      const normalized = validProfiles.map((p) => {
        const enabled = (p.enabledModels || []).filter((m) => p.models.includes(m));
        const pool = enabled.length ? enabled : p.models;
        return {
          ...p,
          apiKey: effectiveKey(p),
          enabledModels: enabled,
          model: pool.includes(p.model) ? p.model : pool[0] || '',
        };
      });
      const activeNorm = normalized.find((p) => p.id === active.id);
      await saveProfiles(normalized, active.id);
      saveConfig({
        provider: 'custom',
        model: activeNorm.model,
        currentModel: activeNorm.model,
        contextTokens: contextTokens || 8000,
        think,
      });
    } else if (provider === 'backend') {
      if (!backendApiUrl.trim()) {
        message.warning('请填写 API 接口地址');
        return;
      }
      if (!backendModel.trim()) {
        message.warning('请填写模型名称');
        return;
      }
      try {
        // apiKey 为空表示"沿用后端已保存的旧值"，避免每次打开都要求重新输入
        await saveBackendLlmConfig({
          apiUrl: backendApiUrl,
          apiKey: backendApiKey,
          model: backendModel,
          provider: backendProvider,
        });
      } catch (error) {
        message.error('保存到服务器失败：' + (error.response?.data?.message || error.message));
        return;
      }
      // 本地只记一个指针：当前用的是 backend 模式 + 展示哪个模型，真正的 Key 留在服务端
      saveConfig({
        provider: 'backend',
        currentModel: backendModel.trim(),
        model: backendModel.trim(),
        contextTokens: contextTokens || 8000,
        think,
      });
    } else {
      saveConfig({
        provider: 'demo',
        currentModel: 'demo-assistant',
        contextTokens: contextTokens || 8000,
        think,
      });
    }
    message.success(t('settingsSaved') || '设置已保存，立即生效');
    onClose();
  };

  const modalThemeClass = isDark ? 'settings-modal settings-modal-dark' : 'settings-modal settings-modal-light';
  const dropdownPopupClass = isDark ? 'settings-modal-dropdown settings-modal-dropdown-dark' : 'settings-modal-dropdown';
  const labelCls = `block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-slate-500'}`;
  const helpTextCls = `text-xs leading-relaxed ${isDark ? 'text-zinc-500' : 'text-slate-500'}`;
  // 扁平分区风格：不再用"卡片套卡片"的重边框方块，改成同一层级内用细分割线
  // 区隔各区块，减少不必要的留白与视觉重量，弹窗内容更紧凑
  const sectionCls = `pt-4 mt-4 border-t first:pt-0 first:mt-0 first:border-t-0 ${
    isDark ? 'border-white/10' : 'border-slate-200'
  }`;
  const inputCls = `rounded-xl px-4 py-2.5 text-sm ${classes.themeTransition} ${
    isDark
      ? 'bg-[#121212] text-white border-white/10 focus:bg-[#121212] focus:border-zinc-500 focus:text-white placeholder:text-zinc-600'
      : 'bg-white text-slate-950 border-slate-200 placeholder:text-slate-400'
  }`;
  const successTextCls = isDark ? 'text-emerald-300' : 'text-green-500';
  const errorTextCls = isDark ? 'text-rose-300' : 'text-red-400';

  const selectedPreset = selected ? PROVIDER_PRESETS.find((p) => p.id === selected.id) : null;

  // 服务商卡片：内置预设 + 自定义 profile 按 chipOrder 混排成一份统一列表
  const chipItems = chipOrder
    .map((id) => {
      const preset = PROVIDER_PRESETS.find((p) => p.id === id);
      if (preset) return { id, isPreset: true, name: preset.name, preset, configured: profiles.find((p) => p.id === id) };
      const custom = profiles.find((p) => p.id === id);
      return custom ? { id, isPreset: false, name: custom.name, configured: custom } : null;
    })
    .filter(Boolean);

  // 通用参数（纵向排列）：custom 模式并入模型卡，demo/backend 模式单独成卡
  const generalParams = (
    <div className="space-y-3 pt-1">
      <div className="space-y-1">
        <p className={helpTextCls}>上下文预算 (Token)</p>
        <InputNumber
          value={contextTokens}
          onChange={(v) => setContextTokens(v)}
          min={1000}
          max={200000}
          step={1000}
          className={`w-full ${isDark ? 'bg-[#121212] border-white/10' : ''}`}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className={helpTextCls}>Think 模式（展示思考过程）</p>
        <Switch checked={think} onChange={setThink} />
      </div>
    </div>
  );

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
            isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-600'
          }`}>
            <ServerCog size={20} />
          </span>
          <div>
            <span className={`block text-base font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>
              {t('settings') || '模型与 API 配置'}
            </span>
            <span className={`block text-xs font-normal ${isDark ? 'text-zinc-500' : 'text-slate-500'}`}>
              可同时配置多家模型服务商，在聊天页顶部快速切换
            </span>
          </div>
        </div>
      }
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} className={isDark ? 'bg-transparent text-zinc-300 border-white/10 hover:bg-white/5' : ''}>
          {t('cancel') || '取消'}
        </Button>,
        <Button key="save" type="primary" onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 border-0 shadow-none">
          {t('save') || '保存'}
        </Button>,
      ]}
      className={modalThemeClass}
      wrapClassName={isDark ? 'settings-modal-wrap settings-modal-wrap-dark' : 'settings-modal-wrap'}
      centered
      width={720} /* 小屏由 antd 默认 max-width: calc(100vw - 32px) 收窄 */
      styles={{
        body: {
          backgroundColor: isDark ? '#18181b' : '#ffffff',
          color: isDark ? '#f4f4f5' : '#0f172a',
          maxHeight: '70vh',
          overflowY: 'auto',
        },
        header: {
          backgroundColor: isDark ? '#18181b' : '#ffffff',
          borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
          paddingBottom: '16px',
        },
        mask: {
          backgroundColor: isDark ? 'rgba(0, 0, 0, 0.68)' : 'rgba(15, 23, 42, 0.36)',
        },
      }}
    >
      <div className="py-5">
        {/* 服务提供商选择 */}
        <div className={`${sectionCls} space-y-3`}>
          <label className={labelCls}>{t('apiProvider') || '接口服务提供商'}</label>
          <Radio.Group
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="flex flex-col sm:flex-row gap-3 w-full"
          >
            {[
              { value: 'demo', icon: Sparkles, label: t('demoMockMode') || '前端演示模式' },
              { value: 'custom', icon: Bot, label: t('customOpenAi') || '模型服务商' },
              // 服务器托管模式依赖真实登录后端（USE_LOCAL_DATA=false 部署），
              // 演示/本地部署下没有意义，不展示这个选项，避免用户点了却因为没登录而困惑
              ...(!USE_LOCAL_DATA
                ? [{ value: 'backend', icon: Server, label: t('backendHosted') || '服务器托管' }]
                : []),
            ].map((opt) => (
              <Radio.Button
                key={opt.value}
                value={opt.value}
                className={`flex-1 text-center py-2 h-auto rounded-xl ${classes.themeTransition} ${
                  isDark
                    ? 'bg-[#121212] text-zinc-200 border-white/10 hover:text-white hover:border-zinc-500'
                    : 'bg-white text-slate-700 border-slate-200 hover:text-slate-950 hover:border-slate-300'
                }`}
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <opt.icon size={14} className="shrink-0" />
                  {opt.label}
                </span>
              </Radio.Button>
            ))}
          </Radio.Group>
          <p className={helpTextCls}>
            {provider === 'demo'
              ? t('demoHint') || '演示模式下无需配置 key，AI 回复采用预设素材，流式打字返回，安全省心。'
              : provider === 'backend'
              ? t('backendHint') ||
                '登录后台账号后，模型请求经服务端转发，API Key 只存在服务端，不经过浏览器，也不受各家模型商 CORS 限制。'
              : t('customHint') ||
                '支持任何兼容 OpenAI 格式的大模型 API（DeepSeek、Kimi、通义、智谱、OpenRouter、Claude、Gemini、本地 Ollama 等），可同时配置多家。'}
          </p>
        </div>

        {provider === 'custom' && (
          <>
            {/* 服务商预设 + 已配置列表 */}
            <div className={`${sectionCls} space-y-2.5`}>
              <label className={labelCls}>服务商（点击切换或添加，可拖拽排序）</label>
              <div className="flex flex-wrap gap-1.5">
                {chipItems.map((item) => {
                  const isActive = selectedId === item.id;
                  const isDragOver = dragOverId === item.id;
                  return (
                    <div
                      key={item.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverId !== item.id) setDragOverId(item.id);
                      }}
                      onDragLeave={() => setDragOverId((prev) => (prev === item.id ? null : prev))}
                      onDrop={(e) => {
                        e.preventDefault();
                        reorderChips(dragIdRef.current, item.id);
                        dragIdRef.current = null;
                        setDragOverId(null);
                      }}
                      className={`group rounded-full border text-xs inline-flex items-center overflow-hidden ${classes.themeTransition} ${
                        isDragOver ? (isDark ? 'ring-2 ring-blue-400/60' : 'ring-2 ring-blue-400') : ''
                      } ${
                        isActive
                          ? isDark
                            ? 'border-blue-400 bg-blue-500/10 text-blue-300'
                            : 'border-blue-500 bg-blue-50 text-blue-600'
                          : isDark
                          ? 'border-white/10 bg-black/20 text-zinc-300 hover:border-zinc-500 hover:text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950'
                      }`}
                    >
                      {/* 单独的小拖拽把手：整块可点击区域不带 draggable，
                          避免"点击"和"拖拽"两种手势在同一元素上冲突（误触发拖拽/点击不生效） */}
                      <span
                        draggable
                        onDragStart={() => {
                          dragIdRef.current = item.id;
                        }}
                        onDragEnd={() => {
                          dragIdRef.current = null;
                          setDragOverId(null);
                        }}
                        title="拖拽调整顺序"
                        className="pl-2 pr-0.5 py-1 flex items-center opacity-0 group-hover:opacity-40 hover:!opacity-80 cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical size={10} />
                      </span>
                      <button
                        type="button"
                        onClick={() => (item.isPreset ? applyPreset(item.preset) : setSelectedId(item.id))}
                        className="pl-0.5 pr-2.5 py-1 flex items-center gap-1"
                      >
                        {item.configured && (
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              item.configured.apiKey || item.configured.hasApiKey ? 'bg-emerald-400' : 'bg-stone-400'
                            }`}
                            title={item.configured.apiKey || item.configured.hasApiKey ? '已配置密钥' : '已添加，未填密钥'}
                          />
                        )}
                        {item.name}
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addCustomProfile}
                  className={`rounded-full border border-dashed px-2.5 py-1 text-xs inline-flex items-center gap-0.5 ${classes.themeTransition} ${
                    isDark
                      ? 'border-white/20 text-zinc-400 hover:border-zinc-400 hover:text-white'
                      : 'border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-800'
                  }`}
                >
                  <Plus size={12} /> 自定义
                </button>
              </div>
              <p className={helpTextCls}>绿点 = 已配置密钥；灰点 = 待配置。自定义服务商最多 10 个，内置服务商不可删除。</p>
            </div>

            {selected && (
              <>
                {/* 连接：地址 + 密钥 + 测试合并为一张卡 */}
                <div className={`${sectionCls} space-y-2.5`}>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>{selected.name} · 连接</label>
                    <div className="flex items-center gap-3">
                      {selectedPreset?.docs && (
                        <a
                          href={selectedPreset.docs}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 text-xs ${
                            isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-600 hover:text-blue-500'
                          }`}
                        >
                          获取密钥 <ExternalLink size={11} />
                        </a>
                      )}
                      {/* 内置预设不可删除，只有自定义服务商能删除 */}
                      {!selectedPreset && (
                        <Popconfirm
                          title={`删除「${selected.name}」的配置？`}
                          onConfirm={removeSelected}
                          okText="删除"
                          cancelText="取消"
                        >
                          <button
                            type="button"
                            className={`inline-flex items-center gap-1 text-xs ${
                              isDark ? 'text-rose-300 hover:text-rose-200' : 'text-rose-500 hover:text-rose-400'
                            }`}
                          >
                            <Trash2 size={11} /> 删除
                          </button>
                        </Popconfirm>
                      )}
                    </div>
                  </div>
                  {!selectedPreset && (
                    <Input
                      value={selected.name}
                      onChange={(e) => updateSelected({ name: e.target.value })}
                      placeholder="服务商名称（用于模型选择器分组显示）"
                      className={inputCls}
                    />
                  )}
                  <Input
                    value={selected.apiUrl}
                    onChange={(e) => {
                      updateSelected({ apiUrl: e.target.value });
                      setTestState('idle');
                    }}
                    placeholder="接口地址，例如 https://api.deepseek.com/v1"
                    className={inputCls}
                  />
                  <Input.Password
                    value={selected.apiKey}
                    onChange={(e) => {
                      updateSelected({ apiKey: e.target.value });
                      setTestState('idle');
                    }}
                    placeholder={
                      selected.hasApiKey
                        ? 'API Key 已加密保存（不回显），留空则沿用'
                        : 'API Key，例如 sk-xxxxxxxxxxxxxxxx'
                    }
                    className={inputCls}
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    <TestConnection
                      onTest={handleTest}
                      state={testState}
                      message={testMessage}
                      disabled={!selected.apiUrl?.trim()}
                      isDark={isDark}
                      classes={classes}
                      successCls={successTextCls}
                      errorCls={errorTextCls}
                    />
                  </div>
                  <p className={helpTextCls}>密钥加密存于本地、不回显；高安全需求用「服务器托管」。</p>
                </div>

                {/* 模型与通用参数合并为一张卡 */}
                <div className={`${sectionCls} space-y-2.5`}>
                  <label className={`${labelCls} flex items-center gap-2`}>
                    启用的模型
                    {modelsAutoLoading && (
                      <span className="flex items-center gap-1 text-blue-400 normal-case tracking-normal font-normal">
                        <Loader2 size={12} className="animate-spin" /> 自动获取中…
                      </span>
                    )}
                  </label>
                  <Select
                    mode="tags"
                    value={selected.enabledModels || []}
                    onChange={(vals) => {
                      if (vals.length === 0) clearedEnabledRef.current.add(selected.id);
                      else clearedEnabledRef.current.delete(selected.id);
                      updateSelected({
                        enabledModels: vals,
                        // 手输的新模型名并入候选，刷新拉取时也不会丢
                        models: [...new Set([...selected.models, ...vals])],
                        model: vals.includes(selected.model) ? selected.model : vals[0] || selected.models[0] || '',
                      });
                    }}
                    options={selected.models.map((m) => ({ value: m, label: m }))}
                    placeholder="勾选或输入模型名；留空则该服务商不出现在顶部列表"
                    className="w-full"
                    classNames={{ popup: { root: dropdownPopupClass } }}
                    showSearch
                    maxTagCount="responsive"
                    allowClear
                    tokenSeparators={[',']}
                  />
                  <p className={helpTextCls}>候选项自动来自平台，第一个为默认模型。</p>
                  {generalParams}
                </div>
              </>
            )}
          </>
        )}

        {provider === 'backend' && (
          <>
            {backendLoadError && (
              <div className={`${sectionCls} text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                {backendLoadError}
              </div>
            )}

            <div className={`${sectionCls} space-y-3`}>
              <label className={labelCls}>接口类型</label>
              <Radio.Group
                value={backendProvider}
                onChange={(e) => { setBackendProvider(e.target.value); setBackendTestState('idle'); }}
                disabled={backendLoading}
                className="flex gap-3 w-full"
              >
                {[
                  { value: 'custom', label: 'OpenAI 兼容' },
                  { value: 'ollama', label: 'Ollama 原生' },
                ].map((opt) => (
                  <Radio.Button
                    key={opt.value}
                    value={opt.value}
                    className={`flex-1 text-center py-1 h-auto rounded-xl ${classes.themeTransition} ${
                      isDark
                        ? 'bg-[#121212] text-zinc-200 border-white/10 hover:text-white hover:border-zinc-500'
                        : 'bg-white text-slate-700 border-slate-200 hover:text-slate-950 hover:border-slate-300'
                    }`}
                  >
                    {opt.label}
                  </Radio.Button>
                ))}
              </Radio.Group>
              <p className={helpTextCls}>
                大多数平台选「OpenAI 兼容」；本机 Ollama 的思考型模型选「Ollama 原生」可支持 think 开关、避免思维链拖慢首字节。
              </p>
            </div>

            <div className={`${sectionCls} space-y-2`}>
              <label className={labelCls}>{t('apiUrl') || 'API 接口地址 (Base URL)'}</label>
              <Input
                value={backendApiUrl}
                onChange={(e) => { setBackendApiUrl(e.target.value); setBackendTestState('idle'); }}
                placeholder="例如: https://api.deepseek.com/v1"
                disabled={backendLoading}
                className={inputCls}
              />
            </div>

            <div className={`${sectionCls} space-y-2`}>
              <label className={labelCls}>{t('apiKey') || 'API 密钥 (API Key)'}</label>
              <Input.Password
                value={backendApiKey}
                onChange={(e) => { setBackendApiKey(e.target.value); setBackendTestState('idle'); }}
                placeholder={backendHasApiKey ? '已在服务器保存，留空则不修改' : 'sk-xxxxxxxxxxxxxxxxxxxxxxxx'}
                disabled={backendLoading}
                className={inputCls}
              />
              <p className={helpTextCls}>
                密钥经加密后保存在服务器数据库里，浏览器只知道&ldquo;已配置&rdquo;，不会拿到明文。
              </p>
            </div>

            {/* 连接测试：由服务端拉取上游模型列表验证地址/密钥（不受浏览器 CORS 限制） */}
            <div className={`${sectionCls} space-y-2`}>
              <TestConnection
                onTest={handleBackendTest}
                state={backendTestState}
                message={backendTestMessage}
                disabled={!backendApiUrl.trim() || backendLoading}
                isDark={isDark}
                classes={classes}
                successCls={successTextCls}
                errorCls={errorTextCls}
              />
            </div>

            <div className={`${sectionCls} space-y-2`}>
              <label className={labelCls}>{t('modelName') || '模型名称'}</label>
              <Input
                value={backendModel}
                onChange={(e) => { backendModelEditedRef.current = true; setBackendModel(e.target.value); }}
                placeholder="填好地址后自动获取，或手动输入，例如: deepseek-v4-flash"
                disabled={backendLoading}
                className={inputCls}
              />
            </div>
          </>
        )}

        {/* demo / backend 模式下通用参数单独成卡（custom 已并入模型卡） */}
        {provider !== 'custom' && (
          <div className={`${sectionCls} space-y-3`}>
            <label className={labelCls}>通用参数</label>
            {generalParams}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SettingsModal;
