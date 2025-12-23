// LLM 配置管理 + 请求代理。
//
// 设计目的：
// 1. 真实的 API Key 只存在服务端（加密落库），前端和浏览器网络面板都看不到明文；
// 2. 代理转发天然绕开浏览器 CORS 限制——服务端对服务端请求不受同源策略约束；
// 3. 响应体形状与前端 apis/providers/openai.js 已经在解析的 OpenAI SSE 格式一致，
//    前端只需要新增一个 BackendProvider 做转发，不需要改消息解析逻辑。

import { Router } from 'express';
import { getLlmConfig, upsertLlmConfig } from '../db.js';
import { encrypt, decrypt } from '../crypto.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);

// 读取当前用户保存的配置。出于安全考虑不回传明文 Key，只回传是否已配置。
router.get('/config', (req, res) => {
  const config = getLlmConfig(req.session.userId);
  if (!config) {
    return res.json({ provider: 'custom', apiUrl: '', model: '', hasApiKey: false });
  }
  res.json({
    provider: config.provider,
    apiUrl: config.api_url,
    model: config.model,
    hasApiKey: Boolean(config.api_key_encrypted),
  });
});

// 保存/更新配置。apiKey 为空字符串时表示"保留原有 Key 不变"（避免每次保存都要求重新输入）。
router.put('/config', (req, res) => {
  const { provider = 'custom', apiUrl = '', apiKey, model = '' } = req.body || {};
  if (!apiUrl.trim()) return res.status(400).json({ message: '请填写 API 接口地址' });
  if (!model.trim()) return res.status(400).json({ message: '请填写模型名称' });

  const existing = getLlmConfig(req.session.userId);
  const apiKeyEncrypted =
    apiKey && apiKey.trim() ? encrypt(apiKey.trim()) : existing?.api_key_encrypted || '';

  upsertLlmConfig(req.session.userId, { provider, apiUrl: apiUrl.trim(), apiKeyEncrypted, model: model.trim() });
  res.json({ ok: true });
});

// 是否是本机/局域网 Ollama 默认端口。Ollama 的 OpenAI 兼容层（/v1/chat/completions）
// 不支持 think 参数，思考型模型会把大段思维链堆在 reasoning 字段里拖慢首字节时间；
// 原生 /api/chat 接口支持 think:false 直接跳过思考。命中该端口时改走原生接口。
const isOllamaHost = (apiUrl) => /:11434\b/.test(apiUrl);

// 把 Ollama 原生 /api/chat 的 NDJSON chunk 转成前端已经在解析的 OpenAI SSE 格式，
// 这样协议差异完全在服务端吸收，前端 BaseProvider 不需要认识第二种格式。
const toSseChunk = (delta) =>
  `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;

async function proxyOpenAiCompat({ config, apiKey, messages, model, signal, res }) {
  let url = config.api_url.replace(/\/+$/, '');
  if (!url.endsWith('/chat/completions')) url = `${url}/chat/completions`;

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: model || config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    }),
    signal,
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    res.status(upstream.status).json({ message: `上游返回错误 (${upstream.status}): ${text}` });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(value); // 已经是目标 SSE 格式，原样透传
    }
  } finally {
    reader.releaseLock();
    res.end();
  }
}

async function proxyOllamaNative({ config, messages, model, think, signal, res }) {
  // apiUrl 通常配的是 OpenAI 兼容地址（.../v1），原生接口在同一 host 的 /api/chat 上
  const url = `${config.api_url.replace(/\/+$/, '').replace(/\/v1$/, '')}/api/chat`;

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model || config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      think: Boolean(think),
    }),
    signal,
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => '');
    res.status(upstream.status).json({ message: `上游返回错误 (${upstream.status}): ${text}` });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const chunk = JSON.parse(trimmed);
          if (chunk.message?.thinking) res.write(toSseChunk({ reasoning: chunk.message.thinking }));
          if (chunk.message?.content) res.write(toSseChunk({ content: chunk.message.content }));
          if (chunk.done) res.write('data: [DONE]\n\n');
        } catch {
          // 忽略无法解析的行（理论上不会出现，防御性处理）
        }
      }
    }
  } finally {
    reader.releaseLock();
    res.end();
  }
}

// 转发聊天补全请求，流式把上游响应中转给前端（统一成 OpenAI SSE 格式）。
router.post('/chat/completions', async (req, res) => {
  const config = getLlmConfig(req.session.userId);
  if (!config?.api_url) {
    return res.status(400).json({ message: '尚未配置模型服务，请先在设置里保存 API 地址' });
  }

  const apiKey = decrypt(config.api_key_encrypted);
  const { messages, model, think } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: 'messages 不能为空' });
  }

  const upstreamController = new AbortController();
  // 客户端断开连接（用户点了停止 / 关闭页面）时，同步中止对上游的请求，
  // 避免后端继续为一个没人接收的响应付费/占用连接
  req.on('close', () => upstreamController.abort());

  const proxy = isOllamaHost(config.api_url) ? proxyOllamaNative : proxyOpenAiCompat;

  try {
    await proxy({ config, apiKey, messages, model, think, signal: upstreamController.signal, res });
  } catch (error) {
    if (error.name === 'AbortError') return; // 客户端已断开，无需再响应
    if (!res.headersSent) {
      res.status(502).json({ message: `无法连接模型服务：${error.message}` });
    } else {
      console.error('上游流转发出错:', error);
      res.end();
    }
  }
});

export default router;
