import { useState, useEffect, useRef } from 'react';
import { Modal, Input, Radio, Button, Select, InputNumber, Switch, message, Popconfirm } from 'antd';
import { Zap, CheckCircle2, XCircle, Loader2, ServerCog, Trash2, Plus, ExternalLink } from 'lucide-react';
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
  // 用户手动改过模型列表的 profile 集合——改过就不再用自动拉取的结果覆盖，尊重手工维护
  const modelsEditedRef = useRef(new Set());
  // 记录每个 profile 上一次自动拉取用的「地址|密钥」签名，避免同样的值重复请求
  const lastFetchSigRef = useRef(new Map());

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
    // 已保存过的 profile 视为"用户维护过"，不让自动拉取覆盖其模型列表
    modelsEditedRef.current = new Set(
      config.profiles.filter((p) => p.models.length > 1).map((p) => p.id)
    );
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
        model: preset.fallbackModels[0],
      };
      setProfiles((prev) => [...prev, profile]);
      setSelectedId(preset.id);
    }
    setTestState('idle');
    setTestMessage('');
  };

  // 新建一个空白的自定义服务商
  const addCustomProfile = () => {
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

  // 把拉取到的模型 id 列表写入选中 profile（最多 200 个）。
  // 已勾选的启用模型裁剪到仍然存在的 id；全部失效则回到"未勾选=全部启用"
  const applyFetchedModels = (ids) => {
    const list = ids.slice(0, 200);
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== selectedId) return p;
        const enabled = (p.enabledModels || []).filter((m) => list.includes(m));
        return {
          ...p,
          models: list,
          enabledModels: enabled,
          model: list.includes(p.model) ? p.model : list[0],
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
        applyFetchedModels(ids);
        modelsEditedRef.current.delete(selected.id); // 拉取结果，仍允许后续自动刷新
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

  // 自动拉取模型：填好地址（+密钥）后防抖自动请求 /models 生成模型列表，
  // 让预设不会因为模型下线而过时。用户手动改过列表则不覆盖；失败静默（保留兜底预设）。
  useEffect(() => {
    if (provider !== 'custom' || !selected) return;
    const base = selected.apiUrl?.trim();
    if (!base || modelsEditedRef.current.has(selected.id)) return;
    const sig = base + '|' + (selected.apiKey || '').trim();
    if (sig === lastFetchSigRef.current.get(selected.id)) return;

    const timer = setTimeout(async () => {
      setModelsAutoLoading(true);
      try {
        const ids = await fetchOpenAiModelIds(selected.apiUrl, effectiveKey(selected));
        lastFetchSigRef.current.set(selected.id, sig);
        if (ids.length && !modelsEditedRef.current.has(selected.id)) {
          applyFetchedModels(ids);
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
  const fieldGroupCls = `rounded-2xl border p-4 ${classes.themeTransition} ${
    isDark ? 'border-white/10 bg-white/[0.03]' : 'border-slate-200 bg-slate-50/70'
  }`;
  const inputCls = `rounded-xl px-4 py-2.5 text-sm ${classes.themeTransition} ${
    isDark
      ? 'bg-[#121212] text-white border-white/10 focus:bg-[#121212] focus:border-zinc-500 focus:text-white placeholder:text-zinc-600'
      : 'bg-white text-slate-950 border-slate-200 placeholder:text-slate-400'
  }`;
  const successTextCls = isDark ? 'text-emerald-300' : 'text-green-500';
  const errorTextCls = isDark ? 'text-rose-300' : 'text-red-400';

  const selectedPreset = selected ? PROVIDER_PRESETS.find((p) => p.id === selected.id) : null;

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
      <div className="py-5 space-y-4">
        {/* 服务提供商选择 */}
        <div className={`${fieldGroupCls} space-y-3`}>
          <label className={labelCls}>{t('apiProvider') || '接口服务提供商'}</label>
          <Radio.Group
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="flex flex-col sm:flex-row gap-3 w-full"
          >
            {[
              { value: 'demo', label: `🚀 ${t('demoMockMode') || '前端演示模式'}` },
              { value: 'custom', label: `🤖 ${t('customOpenAi') || '模型服务商'}` },
              // 服务器托管模式依赖真实登录后端（USE_LOCAL_DATA=false 部署），
              // 演示/本地部署下没有意义，不展示这个选项，避免用户点了却因为没登录而困惑
              ...(!USE_LOCAL_DATA
                ? [{ value: 'backend', label: `🖥️ ${t('backendHosted') || '服务器托管'}` }]
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
                {opt.label}
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
          <div className="space-y-4 animate-fadeIn">
            {/* 服务商预设 + 已配置列表 */}
            <div className={`${fieldGroupCls} space-y-3`}>
              <label className={labelCls}>服务商（点击切换或添加）</label>
              <div className="flex flex-wrap gap-2">
                {PROVIDER_PRESETS.map((preset) => {
                  const configured = profiles.find((p) => p.id === preset.id);
                  const isActive = selectedId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`rounded-full border px-3 py-1.5 text-xs inline-flex items-center gap-1.5 ${classes.themeTransition} ${
                        isActive
                          ? isDark
                            ? 'border-blue-400 bg-blue-500/10 text-blue-300'
                            : 'border-blue-500 bg-blue-50 text-blue-600'
                          : isDark
                          ? 'border-white/10 bg-black/20 text-zinc-300 hover:border-zinc-500 hover:text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950'
                      }`}
                    >
                      {configured && (
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            configured.apiKey || configured.hasApiKey ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                          title={configured.apiKey || configured.hasApiKey ? '已配置密钥' : '已添加，未填密钥'}
                        />
                      )}
                      {preset.name}
                    </button>
                  );
                })}
                {/* 非预设的自定义 profile 也展示出来 */}
                {profiles
                  .filter((p) => !PROVIDER_PRESETS.some((preset) => preset.id === p.id))
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs inline-flex items-center gap-1.5 ${classes.themeTransition} ${
                        selectedId === p.id
                          ? isDark
                            ? 'border-blue-400 bg-blue-500/10 text-blue-300'
                            : 'border-blue-500 bg-blue-50 text-blue-600'
                          : isDark
                          ? 'border-white/10 bg-black/20 text-zinc-300 hover:border-zinc-500 hover:text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${p.apiKey || p.hasApiKey ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      {p.name}
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={addCustomProfile}
                  className={`rounded-full border border-dashed px-3 py-1.5 text-xs inline-flex items-center gap-1 ${classes.themeTransition} ${
                    isDark
                      ? 'border-white/20 text-zinc-400 hover:border-zinc-400 hover:text-white'
                      : 'border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-800'
                  }`}
                >
                  <Plus size={12} /> 自定义
                </button>
              </div>
              <p className={helpTextCls}>
                绿点 = 已配置密钥；黄点 = 已添加待配置。可同时保存多家，聊天页顶部的模型选择器按服务商分组切换。
              </p>
            </div>

            {selected && (
              <>
                {/* 连接：地址 + 密钥 + 测试合并为一张卡 */}
                <div className={`${fieldGroupCls} space-y-2.5`}>
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
                  <p className={helpTextCls}>
                    密钥 AES-256-GCM 加密存于浏览器本地、不回显明文；高安全需求请用「服务器托管」。
                  </p>
                </div>

                {/* 模型：可用列表 + 启用勾选合并为一张卡 */}
                <div className={`${fieldGroupCls} space-y-2.5`}>
                  <label className={`${labelCls} flex items-center gap-2`}>
                    模型
                    {modelsAutoLoading && (
                      <span className="flex items-center gap-1 text-blue-400 normal-case tracking-normal font-normal">
                        <Loader2 size={12} className="animate-spin" /> 自动获取中…
                      </span>
                    )}
                  </label>
                  <Select
                    mode="tags"
                    value={selected.models}
                    onChange={(vals) => {
                      modelsEditedRef.current.add(selected.id); // 手动编辑后不再被自动拉取覆盖
                      updateSelected({
                        models: vals,
                        model: vals.includes(selected.model) ? selected.model : vals[0] || '',
                      });
                    }}
                    placeholder="可用模型：填好地址与密钥后自动获取，也可手动输入回车添加"
                    className="w-full"
                    classNames={{ popup: { root: dropdownPopupClass } }}
                    open={false /* tags 模式下无候选项，关闭下拉避免空面板 */}
                    suffixIcon={null}
                    maxTagCount={8}
                    tokenSeparators={[',', ' ']}
                  />
                  {selected.models.length > 1 && (
                    <Select
                      mode="multiple"
                      value={
                        selected.enabledModels?.length
                          ? selected.enabledModels.filter((m) => selected.models.includes(m))
                          : []
                      }
                      onChange={(vals) =>
                        updateSelected({
                          enabledModels: vals,
                          model: vals.includes(selected.model) ? selected.model : vals[0] || selected.models[0],
                        })
                      }
                      options={selected.models.map((m) => ({ value: m, label: m }))}
                      placeholder="启用的模型（多选）：勾选的才出现在顶部切换列表，不勾选 = 全部"
                      className="w-full"
                      classNames={{ popup: { root: dropdownPopupClass } }}
                      showSearch
                      maxTagCount="responsive"
                      allowClear
                    />
                  )}
                  <p className={helpTextCls}>
                    上排为该服务商的全部可用模型；下排勾选要在聊天页顶部展示的模型（第一个为默认）。
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {provider === 'backend' && (
          <div className="space-y-4 animate-fadeIn">
            {backendLoadError && (
              <div
                className={`${fieldGroupCls} text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}
              >
                {backendLoadError}
              </div>
            )}

            <div className={`${fieldGroupCls} space-y-3`}>
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

            <div className={`${fieldGroupCls} space-y-2`}>
              <label className={labelCls}>{t('apiUrl') || 'API 接口地址 (Base URL)'}</label>
              <Input
                value={backendApiUrl}
                onChange={(e) => { setBackendApiUrl(e.target.value); setBackendTestState('idle'); }}
                placeholder="例如: https://api.deepseek.com/v1"
                disabled={backendLoading}
                className={inputCls}
              />
            </div>

            <div className={`${fieldGroupCls} space-y-2`}>
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
            <div className={`${fieldGroupCls} space-y-2`}>
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

            <div className={`${fieldGroupCls} space-y-2`}>
              <label className={labelCls}>{t('modelName') || '模型名称'}</label>
              <Input
                value={backendModel}
                onChange={(e) => { backendModelEditedRef.current = true; setBackendModel(e.target.value); }}
                placeholder="填好地址后自动获取，或手动输入，例如: deepseek-v4-flash"
                disabled={backendLoading}
                className={inputCls}
              />
            </div>
          </div>
        )}

        {/* 通用参数：上下文预算 + Think 开关合并为一张卡 */}
        <div className={`${fieldGroupCls} space-y-3`}>
          <label className={labelCls}>通用参数</label>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 space-y-1">
              <p className={helpTextCls}>上下文预算 (Token)：发送前按此截断历史，需小于模型窗口</p>
              <InputNumber
                value={contextTokens}
                onChange={(v) => setContextTokens(v)}
                min={1000}
                max={200000}
                step={1000}
                className={`w-full ${isDark ? 'bg-[#121212] border-white/10' : ''}`}
              />
            </div>
            <div className="flex items-center justify-between sm:justify-start gap-3 sm:w-52">
              <p className={helpTextCls}>Think 模式：展示思考型模型的思考过程</p>
              <Switch checked={think} onChange={setThink} />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
