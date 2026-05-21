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
    size='small'
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
    {msg && <p className={`text-sm ${state === 'ok' ? successCls : errorCls}`}>{msg}</p>}
  </>
);

// 表单的可比较快照：与"打开弹窗时的基线"逐字节比对，判断有没有未保存的修改
const snapshotOf = ({
  provider,
  contextTokens,
  think,
  selectedId,
  profiles,
  backendApiUrl,
  backendApiKey,
  backendModel,
  backendProvider,
}) =>
  JSON.stringify({
    provider,
    contextTokens,
    think,
    selectedId,
    profiles: (profiles || []).map((p) => ({
      id: p.id,
      name: p.name,
      apiUrl: p.apiUrl,
      apiKey: p.apiKey,
      models: p.models,
      enabledModels: p.enabledModels,
    })),
    backend: { backendApiUrl, backendApiKey, backendModel, backendProvider },
  });

let customSeq = 0;
const newCustomId = () => `custom-${Date.now()}-${customSeq++}`;

// 「服务器托管」在服务商列表里的伪 id。原来它是「接口服务提供商」tab 的一个选项，
// 现在 tab 去掉了，它降级成服务商列表里的一张卡片——用户只需要回答"用哪家模型服务"
// 这一个问题，而不是先选模式、再选服务商。
const BACKEND_ID = '__backend__';

const SettingsModal = ({ isOpen, onClose }) => {
  const { isDark, classes } = useTheme();
  const { t } = useLanguage();

  // 多服务商 profile 列表（apiKey 为明文，保存时由配置中心统一编码）
  const [profiles, setProfiles] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [contextTokens, setContextTokens] = useState(8000);
  const [think, setThink] = useState(false);
  // 连接测试状态：idle | testing | ok | fail
  const [testState, setTestState] = useState('idle');
  const [testMessage, setTestMessage] = useState('');
  const [modelsAutoLoading, setModelsAutoLoading] = useState(false);
  // 记录每个 profile 上一次自动拉取用的「地址|密钥」签名，避免同样的值重复请求
  const lastFetchSigRef = useRef(new Map());
  // 打开弹窗（或后端配置加载完）时的表单基线，用于判断"有没有未保存的修改"
  const [baseline, setBaseline] = useState(null);

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

  // provider 不再是用户显式选的"模式"，而是从选中的服务商推导出来的结果：
  //   选中「服务器托管」→ backend；选中任意模型服务商 → custom；
  //   一个都没配（列表里没有选中项）→ 保存时回落 demo，见 handleSave。
  // 这样设置面板只问一个问题："用哪家模型服务"，而不是先选模式再选服务商。
  const provider = selectedId === BACKEND_ID ? 'backend' : 'custom';
  // 一个服务商都没配置过：当前实际跑的是演示模式，需要在面板上说清楚
  const nothingConfigured = provider === 'custom' && !profiles.some((p) => p.apiUrl?.trim());

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
    // 安全：表单不回填明文 key（避免暴露在 DOM/开发者工具里）。
    // apiKey 置空 + hasApiKey 标记"已保存"；留空保存 = 沿用旧值
    const nextProfiles = config.profiles.map((p) => ({
      ...p,
      apiKey: '',
      hasApiKey: Boolean(p.hasApiKey || p.apiKey),
      models: [...p.models],
      enabledModels: [...(p.enabledModels || [])],
    }));
    // 上次用的是服务器托管，就直接选中那张卡；否则选中上次激活的服务商
    const nextSelectedId =
      config.provider === 'backend' && !USE_LOCAL_DATA
        ? BACKEND_ID
        : config.activeProfileId || config.profiles[0]?.id || '';
    const nextProvider = nextSelectedId === BACKEND_ID ? 'backend' : 'custom';
    setProfiles(nextProfiles);
    setSelectedId(nextSelectedId);
    setContextTokens(config.contextTokens);
    setThink(config.think);
    setTestState('idle');
    setTestMessage('');
    setBackendLoadError('');
    // 基线 = 刚加载进来的这份值，之后任何差异都算"未保存的修改"
    setBaseline(
      snapshotOf({
        provider: nextProvider,
        contextTokens: config.contextTokens,
        think: config.think,
        selectedId: nextSelectedId,
        profiles: nextProfiles,
        backendApiUrl,
        backendApiKey,
        backendModel,
        backendProvider,
      })
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
          const url = res.data?.apiUrl || '';
          const model = res.data?.model || '';
          const bp = res.data?.provider === 'ollama' ? 'ollama' : 'custom';
          setBackendApiUrl(url);
          setBackendModel(model);
          setBackendProvider(bp);
          setBackendHasApiKey(Boolean(res.data?.hasApiKey));
          setBackendApiKey('');
          backendModelEditedRef.current = Boolean(res.data?.model);
          // 后端配置是异步落地的，并进基线，避免被当成"用户改动"
          setBaseline((prev) => {
            if (prev === null) return prev;
            const obj = JSON.parse(prev);
            return JSON.stringify({
              ...obj,
              backend: { backendApiUrl: url, backendApiKey: '', backendModel: model, backendProvider: bp },
            });
          });
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
    // 只在打开时取一次配置；backend* 初值只用于组基线，不需要作为依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const formSnapshot = snapshotOf({
    provider,
    contextTokens,
    think,
    selectedId,
    profiles,
    backendApiUrl,
    backendApiKey,
    backendModel,
    backendProvider,
  });
  const dirty = baseline !== null && baseline !== formSnapshot;

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
        // 启用模型一律由用户手动勾选，不默认补选
        enabledModels: [],
        model: '',
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
  // 用户手输的自定义模型名不在拉取结果里也保留；启用模型不做任何默认补选，
  // 完全由用户手动勾选
  const applyFetchedModels = (ids) => {
    const list = ids.slice(0, 200);
    setProfiles((prev) =>
      prev.map((p) => {
        if (p.id !== selectedId) return p;
        const enabled = p.enabledModels || [];
        return {
          ...p,
          models: [...new Set([...list, ...enabled])],
          enabledModels: enabled,
          model: enabled.includes(p.model) ? p.model : enabled[0] || '',
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

  // 按需拉取模型：用户展开「启用的模型」下拉时才请求 /models 生成勾选候选，
  // 避免填地址/密钥过程中的无谓请求；同一「地址|密钥」只拉一次，手输项通过并集保留，失败静默。
  const loadModelsOnDemand = async () => {
    if (provider !== 'custom' || !selected) return;
    const base = selected.apiUrl?.trim();
    if (!base) return;
    const sig = base + '|' + (selected.apiKey || '').trim();
    if (sig === lastFetchSigRef.current.get(selected.id)) return;

    setModelsAutoLoading(true);
    try {
      const ids = await fetchOpenAiModelIds(selected.apiUrl, effectiveKey(selected));
      lastFetchSigRef.current.set(selected.id, sig);
      if (ids.length) {
        applyFetchedModels(ids);
        setTestState('ok');
        setTestMessage(`已获取 ${ids.length} 个模型`);
      }
    } catch {
      // 静默失败：多因平台限制浏览器跨域访问 /models，保留预设兜底，用户可手动"测试连接"
      lastFetchSigRef.current.set(selected.id, sig);
    } finally {
      setModelsAutoLoading(false);
    }
  };

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
      // 一个服务商都没配：不再弹「请至少配置一个服务商」把人拦住——
      // 没有可用服务商时演示模式就是正确答案，直接落库 demo 即可
      if (validProfiles.length === 0) {
        saveConfig({
          provider: 'demo',
          currentModel: 'demo-assistant',
          contextTokens: contextTokens || 8000,
          think,
        });
        message.success(t('settingsSaved') || '设置已保存，立即生效');
        setBaseline(formSnapshot);
        onClose();
        return;
      }
      // 规范每个 profile：key 留空沿用旧值；默认模型取启用列表第一个。
      // 启用模型允许一个都不勾——那只是"这家不在聊天页模型选择器里出现"，不是错误
      const normalized = validProfiles.map((p) => {
        const enabled = (p.enabledModels || []).filter((m) => p.models.includes(m));
        return {
          ...p,
          apiKey: effectiveKey(p),
          enabledModels: enabled,
          model: enabled.includes(p.model) ? p.model : enabled[0] || '',
        };
      });
      // 激活的必须是"有启用模型"的那家，否则聊天页无模型可用；
      // 选中的那家没勾模型就顺延到别家，全都没勾就落回演示模式
      const active =
        normalized.find((p) => p.id === selectedId && p.enabledModels.length) ||
        normalized.find((p) => p.enabledModels.length) ||
        null;
      await saveProfiles(normalized, active?.id || '');
      saveConfig(
        active
          ? {
              provider: 'custom',
              model: active.model,
              currentModel: active.model,
              contextTokens: contextTokens || 8000,
              think,
            }
          : {
              provider: 'demo',
              currentModel: 'demo-assistant',
              contextTokens: contextTokens || 8000,
              think,
            }
      );
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
    }
    message.success(t('settingsSaved') || '设置已保存，立即生效');
    // 保存成功后重新取基线：留在弹窗里继续调整时，状态条会显示"已保存"
    setBaseline(formSnapshot);
    onClose();
  };

  // 关闭前拦截：有未保存修改时先确认，避免误点遮罩/Esc 丢掉刚填的配置
  const handleRequestClose = () => {
    if (!dirty) {
      onClose();
      return;
    }
    Modal.confirm({
      title: '放弃未保存的修改？',
      content: '当前的模型与 API 配置还没保存，关闭后这些改动会丢失。',
      okText: '放弃并关闭',
      cancelText: '继续编辑',
      okButtonProps: { danger: true },
      // 确认框自己不吃 Esc：否则从 Esc 触发时会被同一次按键顺手关掉
      keyboard: false,
      maskClosable: false,
      onOk: onClose,
    });
  };

  const modalThemeClass = isDark ? 'settings-modal settings-modal-dark' : 'settings-modal settings-modal-light';
  const dropdownPopupClass = isDark ? 'settings-modal-dropdown settings-modal-dropdown-dark' : 'settings-modal-dropdown';
  const labelCls = `block text-base${isDark ? 'text-zinc-300' : 'text-slate-700'}`;
  const helpTextCls = `text-sm leading-relaxed ${isDark ? 'text-zinc-500' : 'text-slate-500'}`;
  // 扁平分区风格：不再用"卡片套卡片"的重边框方块，改成同一层级内用细分割线
  // 区隔各区块，减少不必要的留白与视觉重量，弹窗内容更紧凑
  const sectionCls = `pt-4 mt-4 border-t first:pt-0 first:mt-0 first:border-t-0 ${
    isDark ? 'border-white/10' : 'border-slate-200'
  }`;
  // 只覆盖圆角与配色，左右内边距交给 antd 自己——Input/Password/Select/InputNumber
  // 各自的内边距实现不同，一旦手写 px-* 就会互相错位、文字对不齐
  const inputCls = `text-base ${classes.themeTransition} ${
    isDark
      ? 'bg-[#121212] text-white border-white/10 focus:bg-[#121212] focus:border-zinc-500 focus:text-white placeholder:text-zinc-600'
      : 'bg-white text-slate-950 border-slate-200 placeholder:text-slate-400'
  }`;
  const successTextCls = isDark ? 'text-emerald-300' : 'text-green-500';
  const errorTextCls = isDark ? 'text-rose-300' : 'text-red-400';

  const selectedPreset = selected ? PROVIDER_PRESETS.find((p) => p.id === selected.id) : null;

  // 服务商卡片：内置预设在前（按预设表顺序），用户新建的自定义服务商追加在后
  const chipItems = [
    ...PROVIDER_PRESETS.map((preset) => ({ id: preset.id, preset })),
    ...profiles
      .filter((p) => !PROVIDER_PRESETS.some((preset) => preset.id === p.id))
      .map((p) => ({ id: p.id, preset: null })),
  ].map(({ id, preset }) => {
    const configured = profiles.find((p) => p.id === id);
    return {
      id,
      isPreset: !!preset,
      name: preset ? preset.name : configured.name,
      preset,
      configured,
      hasKey: !!(configured && (configured.apiKey || configured.hasApiKey)),
      hasEnabledModels: !!configured?.enabledModels?.length,
    };
  });

  // 「服务器托管」跟在服务商列表末尾，只在接了真实后端的部署下出现。
  // 固定收尾，跟在模型服务商后面
  const providerChips = USE_LOCAL_DATA
    ? chipItems
    : [
        ...chipItems,
        {
          id: BACKEND_ID,
          isBackend: true,
          name: t('backendHosted') || '服务器托管',
          hasKey: backendHasApiKey,
          hasEnabledModels: Boolean(backendModel),
        },
      ];

  // 通用参数一行：上下文预算靠左，展示思考过程贴右
  const generalParams = (
    <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className={labelCls}>上下文预算</span>
        <InputNumber
          value={contextTokens}
          onChange={(v) => setContextTokens(v)}
          min={1000}
          max={200000}
          step={1000}
          size="small"
        />
      </div>
      <div className="flex items-center gap-3">
        <span className={labelCls}>展示思考过程</span>
        <Switch checked={think} onChange={setThink} />
      </div>
    </div>
  );

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${
            isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-600'
          }`}>
            <ServerCog size={16} />
          </span>
          <span className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-950'}`}>
            {t('settings') || '模型与 API 配置'}
          </span>
        </div>
      }
      open={isOpen}
      onCancel={handleRequestClose}
      /* 误点遮罩/误按 Esc 就丢配置太伤：点空白永远不关；有未保存修改时 Esc 也不关，
         只能走「取消 / ×」，那条路上有二次确认 */
      maskClosable={false}
      keyboard={!dirty}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span
            className={`inline-flex items-center gap-2 text-sm ${
              dirty ? (isDark ? 'text-amber-300' : 'text-amber-600') : isDark ? 'text-zinc-500' : 'text-slate-400'
            }`}
          >
            {dirty ? <span className="h-2 w-2 rounded-full bg-current" /> : <CheckCircle2 size={13} />}
            {dirty ? '未保存' : '已保存'}
          </span>
          <span className="flex items-center gap-2">
            <Button onClick={handleRequestClose} className={isDark ? 'bg-transparent text-zinc-300 border-white/10 hover:bg-white/5' : ''}>
              {t('cancel') || '取消'}
            </Button>
            <Button
              type="primary"
              onClick={handleSave}
              disabled={!dirty}
              className="bg-blue-600 hover:bg-blue-500 border-0 shadow-none"
            >
              {t('save') || '保存'}
            </Button>
          </span>
        </div>
      }
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
        {/* 服务商列表：原来「接口服务提供商」tab 的三个模式收敛到了这一份列表里，
            服务器托管（如有）作为末尾一张卡片。列表始终渲染，否则选中托管后就切不回来了 */}
        <div className={`${sectionCls} space-y-3`}>
          <label className={labelCls}>服务商</label>
              <div className="flex flex-wrap gap-2">
                {providerChips.map((item) => {
                  const isActive = selectedId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => (item.isPreset ? applyPreset(item.preset) : setSelectedId(item.id))}
                      className={`rounded-full border px-3 py-1 text-sm inline-flex items-center gap-1 ${classes.themeTransition} ${
                        isActive
                          ? isDark
                            ? 'border-blue-400 bg-blue-500/10 text-blue-300'
                            : 'border-blue-500 bg-blue-50 text-blue-600'
                          : isDark
                          ? 'border-white/10 bg-black/20 text-zinc-300 hover:border-zinc-500 hover:text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950'
                      }`}
                    >
                      {/* 标识仅在"已选启用模型"时出现：绿点=有密钥且已选模型，灰点=已选模型但未填密钥 */}
                      {item.hasEnabledModels && (
                        <span
                          className={`h-2 w-2 rounded-full ${item.hasKey ? 'bg-emerald-400' : 'bg-stone-400'}`}
                          title={item.hasKey ? '已配置密钥并选择模型' : '已选择模型，未填密钥'}
                        />
                      )}
                      {item.name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={addCustomProfile}
                  className={`rounded-full border border-dashed px-3 py-1 text-sm inline-flex items-center gap-1 ${classes.themeTransition} ${
                    isDark
                      ? 'border-white/20 text-zinc-400 hover:border-zinc-400 hover:text-white'
                      : 'border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-800'
                  }`}
                >
                  <Plus size={12} /> 自定义
                </button>
              </div>
              {/* 没配任何服务商时当前实际跑的是演示回复。原来这句话挂在「前端演示模式」
                  这个 tab 下，tab 移除后改成按状态出现，用户不至于疑惑回复是哪来的 */}
              {nothingConfigured && (
                <p className={helpTextCls}>
                  {t('demoHint') || '尚未配置服务商，当前使用演示回复（预设素材，无需密钥）。选择上方任意服务商即可接入真实模型。'}
                </p>
              )}
            </div>

            {provider === 'custom' && selected && (
              <>
                {/* 一张卡按填写顺序排：地址 → 密钥 → 模型，最后才是"测试可用性" */}
                <div className={`${sectionCls} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>{selected.name}</label>
                    <div className="flex items-center gap-3">
                      {selectedPreset?.docs && (
                        <a
                          href={selectedPreset.docs}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`inline-flex items-center gap-1 text-sm ${
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
                            className={`inline-flex items-center gap-1 text-sm ${
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
                      placeholder="服务商名称"
                      className={inputCls}
                    />
                  )}
                  <Input
                    value={selected.apiUrl}
                    onChange={(e) => {
                      updateSelected({ apiUrl: e.target.value });
                      setTestState('idle');
                    }}
                    placeholder="https://api.deepseek.com/v1"
                    className={inputCls}
                  />
                  <Input.Password
                    value={selected.apiKey}
                    onChange={(e) => {
                      updateSelected({ apiKey: e.target.value });
                      setTestState('idle');
                    }}
                    placeholder={selected.hasApiKey ? '已保存，留空则不修改' : 'sk-xxxxxxxx'}
                    className={inputCls}
                  />
                  <Select
                    mode="tags"
                    value={selected.enabledModels || []}
                    onChange={(vals) => {
                      updateSelected({
                        enabledModels: vals,
                        // 手输的新模型名并入候选，刷新拉取时也不会丢
                        models: [...new Set([...selected.models, ...vals])],
                        model: vals.includes(selected.model) ? selected.model : vals[0] || '',
                      });
                    }}
                    options={selected.models.map((m) => ({ value: m, label: m }))}
                    // 展开下拉时才去平台拉模型列表
                    onOpenChange={(open) => {
                      if (open) loadModelsOnDemand();
                    }}
                    loading={modelsAutoLoading}
                    notFoundContent={modelsAutoLoading ? '获取模型中…' : undefined}
                    placeholder="点此选择模型"
                    className={`w-full ${inputCls}`}
                    classNames={{ popup: { root: dropdownPopupClass } }}
                    showSearch
                    maxTagCount="responsive"
                    allowClear
                    tokenSeparators={[',']}
                  />
                  {/* 三项填完再验证，所以放在它们下方；按钮右对齐，结果文案排在它左侧 */}
                  <div className="flex flex-row-reverse justify-start items-center gap-3 flex-wrap pt-1">
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
                </div>

                <div className={`${sectionCls}`}>{generalParams}</div>
              </>
            )}

        {provider === 'backend' && (
          <>
            {backendLoadError && (
              <div className={`${sectionCls} text-base ${isDark ? 'text-red-300' : 'text-red-600'}`}>
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

        {/* 托管模式、以及还没选中任何服务商时，通用参数单独成卡（选中服务商后已并入模型卡） */}
        {(provider === 'backend' || !selected) && (
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
