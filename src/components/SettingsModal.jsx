import React, { useState, useEffect } from 'react';
import { Modal, Input, Radio, Button, Select, InputNumber, message } from 'antd';
import { Zap, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
import { getConfig, saveConfig } from '../store/llmConfig';

// 常用平台预设：一键填入接口地址和推荐模型，降低配置门槛
const PLATFORM_PRESETS = [
  { name: 'OpenAI', apiUrl: 'https://api.openai.com/v1', models: ['gpt-4o', 'gpt-4o-mini'] },
  { name: 'DeepSeek', apiUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
  { name: '智谱 AI', apiUrl: 'https://open.bigmodel.cn/api/paas/v4', models: ['glm-4-plus', 'glm-4-flash'] },
  { name: 'Moonshot', apiUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k'] },
  { name: '通义千问', apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-turbo'] },
  { name: 'Ollama 本地', apiUrl: 'http://localhost:11434/v1', models: ['llama3.1:latest', 'qwen2.5:latest'] },
];

const SettingsModal = ({ isOpen, onClose }) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const [provider, setProvider] = useState('demo');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState([]);
  const [defaultModel, setDefaultModel] = useState('');
  const [contextTokens, setContextTokens] = useState(8000);
  // 连接测试状态：idle | testing | ok | fail
  const [testState, setTestState] = useState('idle');
  const [testMessage, setTestMessage] = useState('');

  // 打开弹窗时从配置中心加载当前值
  useEffect(() => {
    if (!isOpen) return;
    const config = getConfig();
    setProvider(config.provider === 'custom' ? 'custom' : 'demo');
    setApiUrl(config.apiUrl);
    setApiKey(config.apiKey);
    setModels(config.models);
    setDefaultModel(config.model);
    setContextTokens(config.contextTokens);
    setTestState('idle');
    setTestMessage('');
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

  const handleSave = () => {
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
      });
    } else {
      saveConfig({
        provider: 'demo',
        currentModel: 'demo-assistant',
        contextTokens: contextTokens || 8000,
      });
    }
    message.success(t('settingsSaved') || '设置已保存，立即生效');
    onClose();
  };

  const labelCls = `block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`;
  const inputCls = `rounded-xl px-4 py-2.5 text-sm ${
    isDark
      ? 'bg-zinc-900 text-white border-zinc-800 focus:bg-zinc-900 focus:border-zinc-600 focus:text-white'
      : 'bg-white text-black border-gray-300'
  }`;

  return (
    <Modal
      title={
        <span className={isDark ? 'text-white' : 'text-gray-900'}>
          {t('settings') || '模型与 API 配置'}
        </span>
      }
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} className={isDark ? 'bg-transparent text-gray-400 border-gray-700' : ''}>
          {t('cancel') || '取消'}
        </Button>,
        <Button key="save" type="primary" onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 border-0">
          {t('save') || '保存'}
        </Button>,
      ]}
      className={isDark ? 'dark-modal' : ''}
      wrapClassName={isDark ? 'dark-theme-modal-wrap' : ''}
      styles={{
        body: {
          backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
          color: isDark ? '#ffffff' : '#000000',
        },
        header: {
          backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
          borderBottom: isDark ? '1px solid #2d2d2d' : '1px solid #f0f0f0',
          paddingBottom: '12px',
        },
        mask: {
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
        },
      }}
    >
      <div className="py-4 space-y-5">
        {/* 服务提供商选择 */}
        <div className="space-y-2">
          <label className={labelCls}>{t('apiProvider') || '接口服务提供商'}</label>
          <Radio.Group
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="flex flex-col sm:flex-row gap-3 w-full"
          >
            {[
              { value: 'demo', label: `🚀 ${t('demoMockMode') || '前端演示模式'}` },
              { value: 'custom', label: `🤖 ${t('customOpenAi') || '自定义 OpenAI 接口'}` },
            ].map((opt) => (
              <Radio.Button
                key={opt.value}
                value={opt.value}
                className={`flex-1 text-center py-1.5 h-auto rounded-xl ${
                  isDark
                    ? 'bg-zinc-800 text-white border-zinc-700 hover:text-white hover:border-zinc-500'
                    : 'bg-white text-gray-800 border-gray-300'
                }`}
              >
                {opt.label}
              </Radio.Button>
            ))}
          </Radio.Group>
          <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            {provider === 'demo'
              ? (t('demoHint') || '演示模式下无需配置 key，AI 回复采用预设素材，流式打字返回，安全省心。')
              : (t('customHint') || '支持任何兼容 OpenAI 格式的大模型 API。选择下方平台快速填入，或手动配置。')}
          </p>
        </div>

        {provider === 'custom' && (
          <div className="space-y-4 animate-fadeIn">
            {/* 平台预设 */}
            <div className="space-y-2">
              <label className={labelCls}>常用平台</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORM_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      apiUrl === preset.apiUrl
                        ? 'border-blue-500 text-blue-500'
                        : isDark
                        ? 'border-zinc-700 text-zinc-300 hover:border-zinc-500'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* API 地址 */}
            <div className="space-y-2">
              <label className={labelCls}>{t('apiUrl') || 'API 接口地址 (Base URL)'}</label>
              <Input
                value={apiUrl}
                onChange={(e) => { setApiUrl(e.target.value); setTestState('idle'); }}
                placeholder="例如: https://api.deepseek.com/v1"
                className={inputCls}
              />
            </div>

            {/* API 密钥 */}
            <div className="space-y-2">
              <label className={labelCls}>{t('apiKey') || 'API 密钥 (API Key)'}</label>
              <Input.Password
                value={apiKey}
                onChange={(e) => { setApiKey(e.target.value); setTestState('idle'); }}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                className={inputCls}
              />
              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                密钥仅保存在你的浏览器本地（简单编码、非加密）。生产环境建议通过后端代理转发请求。
              </p>
            </div>

            {/* 连接测试 */}
            <div className="space-y-2">
              <Button
                onClick={handleTest}
                disabled={!apiUrl.trim() || testState === 'testing'}
                icon={
                  testState === 'testing' ? <Loader2 size={14} className="animate-spin inline" />
                  : testState === 'ok' ? <CheckCircle2 size={14} className="inline text-green-500" />
                  : testState === 'fail' ? <XCircle size={14} className="inline text-red-500" />
                  : <Zap size={14} className="inline" />
                }
                className={`rounded-xl flex items-center gap-1.5 ${
                  isDark ? 'bg-zinc-800 text-white border-zinc-700' : ''
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
            <div className="space-y-2">
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
                popupClassName={isDark ? 'dark-modal' : ''}
                open={false /* tags 模式下无候选项，关闭下拉避免空面板 */}
                suffixIcon={null}
                tokenSeparators={[',', ' ']}
              />
              <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
                这里维护的模型会出现在顶部的模型切换器中，支持逗号分隔批量粘贴。
              </p>
            </div>

            {/* 默认模型 */}
            {models.length > 1 && (
              <div className="space-y-2">
                <label className={labelCls}>默认模型</label>
                <Select
                  value={models.includes(defaultModel) ? defaultModel : models[0]}
                  onChange={setDefaultModel}
                  options={models.map((m) => ({ value: m, label: m }))}
                  className="w-full"
                  popupClassName={isDark ? 'dark-modal' : ''}
                />
              </div>
            )}
          </div>
        )}

        {/* 上下文预算：demo / custom 都展示 */}
        <div className="space-y-2">
          <label className={labelCls}>上下文长度预算 (Token)</label>
          <InputNumber
            value={contextTokens}
            onChange={(v) => setContextTokens(v)}
            min={1000}
            max={200000}
            step={1000}
            className={`w-full ${isDark ? 'bg-zinc-900 border-zinc-800' : ''}`}
          />
          <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            发送前按此预算截断历史消息，避免长对话超出模型上下文窗口。应小于所用模型的窗口大小并留出回复余量。
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
