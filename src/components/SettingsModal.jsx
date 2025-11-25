import React, { useState, useEffect } from 'react';
import { Modal, Input, Radio, Button, message } from 'antd';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
import { DEFAULT_LLM_PROVIDER, DEFAULT_LLM_MODEL } from '../constants';

const SettingsModal = ({ isOpen, onClose }) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();

  const [provider, setProvider] = useState(DEFAULT_LLM_PROVIDER);
  const [apiUrl, setApiUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(DEFAULT_LLM_MODEL);

  // Load values on mount or when opening
  useEffect(() => {
    if (isOpen) {
      setProvider(localStorage.getItem('llm_provider') || DEFAULT_LLM_PROVIDER);
      setApiUrl(localStorage.getItem('llm_api_url') || 'https://api.openai.com/v1');
      
      const storedKey = localStorage.getItem('llm_api_key') || '';
      if (storedKey.startsWith('b64:')) {
        try {
          setApiKey(atob(storedKey.slice(4)));
        } catch {
          setApiKey(storedKey);
        }
      } else {
        setApiKey(storedKey);
      }
      
      setModel(localStorage.getItem('llm_model') || DEFAULT_LLM_MODEL);
    }
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('llm_provider', provider);
    localStorage.setItem('llm_api_url', apiUrl.trim());
    
    const keyToSave = apiKey.trim();
    if (keyToSave) {
      // 注意：这里的 base64 只是避免明文裸露在 localStorage 里被一眼看到，
      // 不是真正的加密——任何能打开浏览器 devtools 的人都能还原出原始 key。
      // 纯前端应用没有安全存放密钥的地方，生产环境建议通过后端代理转发请求，不要在浏览器里保存真实 API Key。
      localStorage.setItem('llm_api_key', 'b64:' + btoa(keyToSave));
    } else {
      localStorage.setItem('llm_api_key', '');
    }
    
    localStorage.setItem('llm_model', model.trim());

    // Update currentModel in localStorage so the input field uses the new model name
    if (provider === 'custom') {
      localStorage.setItem('currentModel', model.trim());
    } else {
      localStorage.setItem('currentModel', 'demo-assistant');
    }

    message.success(t('settingsSaved') || '设置已保存！');
    onClose();
    // Refresh page to take effect immediately
    window.location.reload();
  };

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
        {/* Provider Selection */}
        <div className="space-y-2">
          <label className={`block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            {t('apiProvider') || '接口服务提供商'}
          </label>
          <Radio.Group
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="flex flex-col sm:flex-row gap-3 w-full"
          >
            <Radio.Button
              value="demo"
              className={`flex-1 text-center py-1.5 h-auto rounded-xl ${
                isDark 
                  ? 'bg-zinc-800 text-white border-zinc-700 hover:text-white hover:border-zinc-500' 
                  : 'bg-white text-gray-800 border-gray-300'
              }`}
            >
              🚀 {t('demoMockMode') || '前端演示模式'}
            </Radio.Button>
            <Radio.Button
              value="custom"
              className={`flex-1 text-center py-1.5 h-auto rounded-xl ${
                isDark 
                  ? 'bg-zinc-800 text-white border-zinc-700 hover:text-white hover:border-zinc-500' 
                  : 'bg-white text-gray-800 border-gray-300'
              }`}
            >
              🤖 {t('customOpenAi') || '自定义 OpenAI 接口'}
            </Radio.Button>
          </Radio.Group>
          <p className={`text-xs ${isDark ? 'text-zinc-500' : 'text-gray-400'}`}>
            {provider === 'demo' 
              ? (t('demoHint') || '演示模式下无需配置 key，AI 回复采用预设素材，流式打字返回，安全省心。') 
              : (t('customHint') || '支持任何兼容 OpenAI 格式的大模型 API，例如 DeepSeek, OpenAI, 智谱 AI, 通义千问, Ollama 等。')}
          </p>
        </div>

        {provider === 'custom' && (
          <div className="space-y-4 animate-fadeIn">
            {/* API Endpoint */}
            <div className="space-y-2">
              <label className={`block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('apiUrl') || 'API 接口地址 (Base URL)'}
              </label>
              <Input
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="例如: https://api.deepseek.com/v1"
                className={`rounded-xl px-4 py-2.5 text-sm ${
                  isDark 
                    ? 'bg-zinc-900 text-white border-zinc-800 focus:bg-zinc-900 focus:border-zinc-600 focus:text-white' 
                    : 'bg-white text-black border-gray-300'
                }`}
              />
            </div>

            {/* API Key */}
            <div className="space-y-2">
              <label className={`block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('apiKey') || 'API 密钥 (API Key)'}
              </label>
              <Input.Password
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-xxxxxxxxxxxxxxxxxxxxxxxx"
                className={`rounded-xl px-4 py-2.5 text-sm ${
                  isDark 
                    ? 'bg-zinc-900 text-white border-zinc-800 focus:bg-zinc-900 focus:border-zinc-600 focus:text-white' 
                    : 'bg-white text-black border-gray-300'
                }`}
              />
            </div>

            {/* Model Name */}
            <div className="space-y-2">
              <label className={`block text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t('modelName') || '模型名称 (Model Name)'}
              </label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="例如: deepseek-chat 或 gpt-4o-mini"
                className={`rounded-xl px-4 py-2.5 text-sm ${
                  isDark 
                    ? 'bg-zinc-900 text-white border-zinc-800 focus:bg-zinc-900 focus:border-zinc-600 focus:text-white' 
                    : 'bg-white text-black border-gray-300'
                }`}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default SettingsModal;
