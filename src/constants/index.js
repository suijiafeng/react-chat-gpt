
// 使用 window 对象来检测是否在浏览器环境中
const isBrowser = typeof window !== 'undefined';

// 假设开发环境使用特定的主机名或端口，你可以根据实际情况调整这个逻辑
const isDev = isBrowser && (window.location.hostname === 'localhost' || window.location.port === '3000');

export const APP_NAME = 'Open WebUI';

export const WEBUI_HOSTNAME = isBrowser ? (isDev ? `${window.location.hostname}:8080` : '') : '';
export const WEBUI_BASE_URL = isBrowser ? (isDev ? `http://${WEBUI_HOSTNAME}` : '') : '';
export const WEBUI_API_BASE_URL = `${WEBUI_BASE_URL}/api/v1`;

export const OLLAMA_API_BASE_URL = `${WEBUI_BASE_URL}/ollama`;
export const OPENAI_API_BASE_URL = `${WEBUI_BASE_URL}/openai`;
export const AUDIO_API_BASE_URL = `${WEBUI_BASE_URL}/audio/api/v1`;
export const IMAGES_API_BASE_URL = `${WEBUI_BASE_URL}/images/api/v1`;
export const RAG_API_BASE_URL = `${WEBUI_BASE_URL}/rag/api/v1`;

// 这些值可能需要在构建时注入，或者从某个配置文件中读取
export const WEBUI_VERSION = 'unknown';
export const WEBUI_BUILD_HASH = 'unknown';
export const REQUIRED_OLLAMA_VERSION = '0.1.16';

export const SUPPORTED_FILE_TYPE = [
    'application/epub+zip',
    'application/pdf',
    'text/plain',
    'text/csv',
    'text/xml',
    'text/html',
    'text/x-python',
    'text/css',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream',
    'application/x-javascript',
    'text/markdown',
    'audio/mpeg',
    'audio/wav'
];

export const SUPPORTED_FILE_EXTENSIONS = [
    'md', 'rst', 'go', 'py', 'java', 'sh', 'bat', 'ps1', 'cmd', 'js', 'ts', 'css',
    'cpp', 'hpp', 'h', 'c', 'cs', 'htm', 'html', 'sql', 'log', 'ini', 'pl', 'pm',
    'r', 'dart', 'dockerfile', 'env', 'php', 'hs', 'hsc', 'lua', 'nginxconf', 'conf',
    'm', 'mm', 'plsql', 'perl', 'rb', 'rs', 'db2', 'scala', 'bash', 'swift', 'vue',
    'svelte', 'doc', 'docx', 'pdf', 'csv', 'txt', 'xls', 'xlsx', 'pptx', 'ppt', 'msg'
];