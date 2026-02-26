import React, { useState, useEffect } from 'react';
import { Modal, Input, Radio, Button, Select, InputNumber, Switch, message } from 'antd';
import { Zap, CheckCircle2, XCircle, Loader2, ServerCog } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
import { getConfig, saveConfig } from '../store/llmConfig';
import { getBackendLlmConfig, saveBackendLlmConfig, testBackendLlmConfig } from '../apis/llm';
import { USE_LOCAL_DATA } from '../constants';

// 常用平台预设：一键填入接口地址和推荐模型，降低配置门槛
const PLATFORM_PRESETS = [
  { name: 'OpenAI', apiUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini'] },
  { name: 'DeepSeek', apiUrl: 'https://api.deepseek.com/v1', models: ['deepseek-v4-flash', 'deepseek-v4-pro'] },
  { name: '智谱 AI', apiUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-plus', 'glm-4-flash'] },
  { name: 'Moonshot', apiUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
  { name: '通义千问', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-turbo'] },
  { name: 'Ollama 本地', apiUrl: 'http://localhost:11434/v1', models: ['llama3.1:latest', 'qwen2.5:latest'] },
];

const SettingsModal = ({ isOpen, onClose }) => {
  const { isDark, classes } = useTheme();
  const { t } = useLanguage();

  const [provider, setProvider] = useState('demo');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState([]);
  const [defaultModel, setDefaultModel] = useState('');
  const [contextTokens, setContextTokens] = useState(8000);
  const [think, setThink] = useState(false);
  // 连接测试状态：idle | testing | ok | fail
  const [testState, setTestState] = useState('idle');
  const [testMessage, setTestMessage] = useState('');

  // "服务器托管"模式专用状态：配置存在后端账号下，不进 localStorage
  const [backendApiUrl, setBackendApiUrl] = useState('');
  const [backendApiKey, setBackendApiKey] = useState('');
  const [backendModel, setBackendModel] = useState('');
  const [backendProvider, setBackendProvider] = useState('custom'); // custom=OpenAI 兼容 | ollama=原生
  const [backendHasApiKey, setBackendHasApiKey] = useState(false);
  const [backendLoading, setBackendLoading] = useState(false);
  const [backendLoadError, setBackendLoadError] = useState('');
  // 后端模式连接测试状态：idle | testing | ok | fail
  const [backendTestState, setBackendTestState] = useState('idle');
  const [backendTestMessage, setBackendTestMessage] = useState('');

  // 打开弹窗时从配置中心加载当前值
  useEffect(() => {
    if (!isOpen) return;
    const config = getConfig();
    setProvider(
      config.provider === 'custom' || config.provider === 'backend' ? config.provider : 'demo'
    );
    setApiUrl(config.apiUrl);
    setApiKey(config.apiKey);
    setModels(config.models);
    setDefaultModel(config.model);
    setContextTokens(config.contextTokens);
    setThink(config.think);
    setTestState('idle');
    setTestMessage('');
    setBackendLoadError('');

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

  // 应用平台预设：填入地址和推荐模型。
  // 用户已维护过多个模型（>1 个）时保留其列表，只换地址
  const applyPreset = (preset) => {
    setApiUrl(preset.apiUrl);
    setModels((prev) => (prev.filter((m) => m.trim()).length > 1 ? prev : preset.models));
    setDefaultModel((prev) => (preset.models.includes(prev) ? prev : preset.models[0]));
    setTestState('idle');
  };

  // 连接测试：请求 {base}/models 验证地址和密钥是否可用，成功时可一键导入模型列表
  const handleTest = async () => {
    setTestState('testing');
    setTestMessage('');
    try {
      const base = apiUrl.trim().replace(/\/+$/, '');
      const headers = {};
      if (apiKey.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      const res = await fetch(`${base}/models`, { headers, signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const ids = (data?.data || []).map((m) => m.id).filter(Boolean);
      setTestState('ok');
      if (ids.length > 0) {
        setTestMessage(`连接成功，检测到 ${ids.length} 个可用模型`);
        // 用户尚未手动维护模型列表时，直接导入检测到的模型（最多 20 个，避免列表过长）
        setModels((prev) => (prev.length <= 1 ? ids.slice(0, 20) : prev));
        setDefaultModel((prev) => (ids.includes(prev) ? prev : ids[0]));
      } else {
        setTestMessage('连接成功');
      }
    } catch (error) {
      setTestState('fail');
      // 部分平台的 /models 接口有 CORS 限制，测试失败不代表对话一定不可用
      setTestMessage(`连接失败：${error.message}（部分平台限制浏览器直接访问，可忽略并直接保存试用）`);
    }
  };

  // 后端模式连接测试：让服务端用当前表单里的地址/密钥去拉模型列表（绕开浏览器 CORS）。
  // apiKey 留空时后端回退到已保存的加密 Key，成功后把模型名自动填入。
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
      const cleanModels = models.map((m) => m.trim()).filter(Boolean);
      if (!apiUrl.trim()) {
        message.warning('请填写 API 接口地址');
        return;
      }
      if (cleanModels.length === 0) {
        message.warning('请至少添加一个模型');
        return;
      }
      const model = cleanModels.includes(defaultModel) ? defaultModel : cleanModels[0];
      saveConfig({
        provider: 'custom',
        apiUrl,
        apiKey,
        models: cleanModels,
        model,
        currentModel: model,
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
              选择演示模式或接入兼容 OpenAI 的模型服务
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
      width={720}
      styles={{
        body: {
          backgroundColor: isDark ? '#18181b' : '#ffffff',
          color: isDark ? '#f4f4f5' : '#0f172a',
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
              { value: 'custom', label: `🤖 ${t('customOpenAi') || '自定义 OpenAI 接口'}` },
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
              : t('customHint') || '支持任何兼容 OpenAI 格式的大模型 API。选择下方平台快速填入，或手动配置。'}
          </p>
        </div>

        {provider === 'custom' && (
          <div className="space-y-4 animate-fadeIn">
            {/* 平台预设 */}
            <div className={`${fieldGroupCls} space-y-3`}>
              <label className={labelCls}>常用平台</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`rounded-full border px-3 py-1.5 text-xs ${classes.themeTransition} ${
                      apiUrl === preset.apiUrl
                        ? isDark
                          ? 'border-blue-400 bg-blue-500/10 text-blue-300'
                          : 'border-blue-500 bg-blue-50 text-blue-600'
                        : isDark
                        ? 'border-white/10 bg-black/20 text-zinc-300 hover:border-zinc-500 hover:text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* API 地址 */}
            <div className={`${fieldGroupCls} space-y-2`}>
              <label className={labelCls}>{t('apiUrl') || 'API 接口地址 (Base URL)'}</label>
              <Input
                value={apiUrl}
                onChange={(e) => { setApiUrl(e.target.value); setTestState('idle'); }}
                placeholder="例如: https://api.deepseek.com/v1"
                className={inputCls}
              />
            </div>

            {/* API 密钥 */}
            <div className={`${fieldGroupCls} space-y-2`}>
              <label className={labelCls}>{t('apiKey') || 'API 密钥 (API Key)'}</label>
              <Input.Password
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestState('idle'); }}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                className={inputCls}
              />
              <p className={helpTextCls}>
                密钥仅保存在你的浏览器本地（简单编码、非加密）。生产环境建议通过后端代理转发请求。
              </p>
            </div>

            {/* 连接测试 */}
            <div className={`${fieldGroupCls} space-y-2`}>
              <Button
                onClick={handleTest}
                disabled={!apiUrl.trim() || testState === 'testing'}
                icon={
                  testState === 'testing' ? <Loader2 size={14} className="animate-spin inline" />
                  : testState === 'ok' ? <CheckCircle2 size={14} className="inline text-green-500" />
                  : testState === 'fail' ? <XCircle size={14} className="inline text-red-500" />
                  : <Zap size={14} className="inline" />
                }
                className={`rounded-xl flex items-center gap-1.5 ${classes.themeTransition} ${
                  isDark ? 'bg-[#121212] text-white border-white/10 hover:bg-white/5' : 'border-slate-200 text-slate-700'
                }`}
              >
                {testState === 'testing' ? '测试中...' : '测试连接'}
              </Button>
              {testMessage && (
                <p className={`text-xs ${testState === 'ok' ? 'text-green-500' : 'text-red-400'}`}>
                  {testMessage}
                </p>
              )}
            </div>

            {/* 模型列表（可多选维护，顶部选择器里切换） */}
            <div className={`${fieldGroupCls} space-y-2`}>
              <label className={labelCls}>{t('modelName') || '模型列表'}</label>
              <Select
                mode="tags"
                value={models}
                onChange={(vals) => {
                  setModels(vals);
                  if (!vals.includes(defaultModel)) setDefaultModel(vals[0] || '');
                }}
                placeholder="输入模型名后回车添加，例如 deepseek-chat"
                className="w-full"
                popupClassName={isDark ? 'settings-modal-dropdown settings-modal-dropdown-dark' : 'settings-modal-dropdown'}
                open={false /* tags 模式下无候选项，关闭下拉避免空面板 */}
                suffixIcon={null}
                tokenSeparators={[',', ' ']}
              />
              <p className={helpTextCls}>
                这里维护的模型会出现在顶部的模型切换器中，支持逗号分隔批量粘贴。
              </p>
            </div>

            {/* 默认模型 */}
            {models.length > 1 && (
              <div className={`${fieldGroupCls} space-y-2`}>
                <label className={labelCls}>默认模型</label>
                <Select
                  value={models.includes(defaultModel) ? defaultModel : models[0]}
                  onChange={setDefaultModel}
                  options={models.map((m) => ({ value: m, label: m }))}
                  className="w-full"
                  popupClassName={isDark ? 'settings-modal-dropdown settings-modal-dropdown-dark' : 'settings-modal-dropdown'}
                />
              </div>
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
              <Button
                onClick={handleBackendTest}
                disabled={!backendApiUrl.trim() || backendLoading || backendTestState === 'testing'}
                icon={
                  backendTestState === 'testing' ? <Loader2 size={14} className="animate-spin inline" />
                  : backendTestState === 'ok' ? <CheckCircle2 size={14} className="inline text-green-500" />
                  : backendTestState === 'fail' ? <XCircle size={14} className="inline text-red-500" />
                  : <Zap size={14} className="inline" />
                }
                className={`rounded-xl flex items-center gap-1.5 ${classes.themeTransition} ${
                  isDark ? 'bg-[#121212] text-white border-white/10 hover:bg-white/5' : 'border-slate-200 text-slate-700'
                }`}
              >
                {backendTestState === 'testing' ? '测试中...' : '测试连接'}
              </Button>
              {backendTestMessage && (
                <p className={`text-xs ${backendTestState === 'ok' ? 'text-green-500' : 'text-red-400'}`}>
                  {backendTestMessage}
                </p>
              )}
            </div>

            <div className={`${fieldGroupCls} space-y-2`}>
              <label className={labelCls}>{t('modelName') || '模型名称'}</label>
              <Input
                value={backendModel}
                onChange={(e) => setBackendModel(e.target.value)}
                placeholder="例如: deepseek-chat"
                disabled={backendLoading}
                className={inputCls}
              />
            </div>
          </div>
        )}

        {/* 上下文预算：demo / custom 都展示 */}
        <div className={`${fieldGroupCls} space-y-2`}>
          <label className={labelCls}>上下文长度预算 (Token)</label>
          <InputNumber
            value={contextTokens}
            onChange={(v) => setContextTokens(v)}
            min={1000}
            max={200000}
            step={1000}
            className={`w-full ${isDark ? 'bg-[#121212] border-white/10' : ''}`}
          />
          <p className={helpTextCls}>
            发送前按此预算截断历史消息，避免长对话超出模型上下文窗口。应小于所用模型的窗口大小并留出回复余量。
          </p>
        </div>

        <div className={`${fieldGroupCls} flex items-center justify-between gap-4`}>
          <div className="space-y-1">
            <label className={labelCls}>Think 模式</label>
            <p className={helpTextCls}>
              开启后请求会携带 think: true，并在支持的 Ollama 模型中显示思考过程；关闭时携带 think: false。
            </p>
          </div>
          <Switch checked={think} onChange={setThink} />
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
