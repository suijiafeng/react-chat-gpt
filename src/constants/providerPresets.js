// 常用模型服务商预设库（均为 OpenAI 兼容协议 /chat/completions）。
//
// 只内置基本不会变的信息：接口地址 + 少量兜底模型名。
// 真实模型列表以「填好地址/密钥后自动请求 {base}/models」为准，避免预设过时；
// fallbackModels 仅在自动拉取失败（如平台限制浏览器跨域）时作为占位提示。
//
// docs 字段是各家「获取 API Key」的入口，设置弹窗里展示为帮助链接。

export const PROVIDER_PRESETS = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiUrl: 'https://api.openai.com/v1',
    fallbackModels: ['gpt-4o', 'gpt-4o-mini'],
    docs: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    apiUrl: 'https://api.deepseek.com/v1',
    fallbackModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    docs: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    apiUrl: 'https://api.anthropic.com/v1',
    fallbackModels: ['claude-sonnet-5', 'claude-opus-4-8', 'claude-haiku-4-5'],
    docs: 'https://platform.claude.com/settings/keys',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    fallbackModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    docs: 'https://aistudio.google.com/apikey',
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4',
    fallbackModels: ['glm-4.5', 'glm-4.5-air'],
    docs: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    id: 'moonshot',
    name: 'Moonshot (Kimi)',
    apiUrl: 'https://api.moonshot.cn/v1',
    fallbackModels: ['kimi-k2-0711-preview', 'moonshot-v1-8k'],
    docs: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    id: 'qwen',
    name: '通义千问',
    apiUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    fallbackModels: ['qwen-plus', 'qwen-turbo'],
    docs: 'https://bailian.console.aliyun.com/?apiKey=1',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    apiUrl: 'https://openrouter.ai/api/v1',
    fallbackModels: ['openai/gpt-4o', 'anthropic/claude-sonnet-5'],
    docs: 'https://openrouter.ai/keys',
  },
  {
    id: 'groq',
    name: 'Groq',
    apiUrl: 'https://api.groq.com/openai/v1',
    fallbackModels: ['llama-3.3-70b-versatile'],
    docs: 'https://console.groq.com/keys',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    apiUrl: 'https://api.siliconflow.cn/v1',
    fallbackModels: ['deepseek-ai/DeepSeek-V3'],
    docs: 'https://cloud.siliconflow.cn/account/ak',
  },
  {
    id: 'xai',
    name: 'xAI (Grok)',
    apiUrl: 'https://api.x.ai/v1',
    fallbackModels: ['grok-3', 'grok-3-mini'],
    docs: 'https://console.x.ai',
  },
  {
    id: 'ollama-local',
    name: 'Ollama 本地',
    apiUrl: 'http://localhost:11434/v1',
    fallbackModels: ['llama3.1:latest', 'qwen2.5:latest'],
    docs: 'https://ollama.com/download',
  },
];

export const getPresetById = (id) => PROVIDER_PRESETS.find((p) => p.id === id);
