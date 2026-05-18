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
import { createRateLimiter } from '../middleware/rateLimit.js';
import { safeFetch, parseUpstreamUrl, UpstreamUrlError } from '../upstreamUrl.js';

const router = Router();
router.use(requireAuth);

// 已登录用户共用同一份上游 API Key，转发即产生真金白银的调用成本，
// 因此按用户 id 限流（每分钟 30 次）。可用环境变量覆盖。
const chatRateLimiter = createRateLimiter({
  windowMs: Number(process.env.LLM_RATE_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.LLM_RATE_MAX) || 30,
  keyFn: (req) => req.session.userId,
  message: '模型请求过于频繁',
});

// 上游错误响应优先按 JSON 解析出可读 message，拿不到再退回原始文本，
// 避免把一大坨 HTML/JSON 直接抛给前端。
const readUpstreamError = async (upstream) => {
  const raw = await upstream.text().catch(() => '');
  try {
    const json = JSON.parse(raw);
    return json?.error?.message || json?.message || raw;
  } catch {
    return raw;
  }
};

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
  if (!model.trim()) return res.status(400).json({ message: '请填写模型名称' });

  // 在落库这一步就把地址挡住：存进去的都是已校验的地址，后续每个转发点仍会再校验一次
  // （防止有人直接改数据库），但用户能在设置页立刻看到错误提示，而不是保存成功、发消息才报错。
  let normalized;
  try {
    normalized = parseUpstreamUrl(apiUrl).toString();
  } catch (error) {
    if (error instanceof UpstreamUrlError) return res.status(400).json({ message: error.message });
    throw error;
  }

  const existing = getLlmConfig(req.session.userId);
  const apiKeyEncrypted =
    apiKey && apiKey.trim() ? encrypt(apiKey.trim()) : existing?.api_key_encrypted || '';

  upsertLlmConfig(req.session.userId, { provider, apiUrl: normalized, apiKeyEncrypted, model: model.trim() });
  res.json({ ok: true });
});

// 向上游请求可用模型列表并统一响应格式。
// 由服务端发起请求：既能带上加密存储的 Key，又绕开浏览器直连各模型商 /models 的 CORS 限制。
const fetchUpstreamModels = async (apiUrl, apiKey, res) => {
  const url = `${apiUrl.replace(/\/+$/, '')}/models`;
  try {
    const upstream = await safeFetch(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) {
      const detail = await readUpstreamError(upstream);
      return res.status(upstream.status).json({ message: `上游返回错误 (${upstream.status}): ${detail}` });
    }
    const data = await upstream.json();
    // 兼容 OpenAI（{ data:[{id}] }）与 Ollama（/v1/models 同样是该形状）
    const ids = Array.isArray(data?.data) ? data.data.map((m) => m.id).filter(Boolean) : [];
    res.json({ data: ids.map((id) => ({ id })) });
  } catch (error) {
    // 地址被安全策略拒绝属于「用户填错了」，是 400 不是 502——502 会让人以为是上游挂了
    if (error instanceof UpstreamUrlError) {
      return res.status(400).json({ message: error.message });
    }
    const msg = error.name === 'TimeoutError' ? '连接超时' : error.message;
    res.status(502).json({ message: `无法获取模型列表：${msg}` });
  }
};

// 拉取当前账号已保存配置对应的模型列表（模型选择器用），密钥从加密存储解出，不经浏览器。
router.get('/models', async (req, res) => {
  const saved = getLlmConfig(req.session.userId);
  const apiUrl = (saved?.api_url || '').trim();
  if (!apiUrl) return res.status(400).json({ message: '尚未配置 API 接口地址' });
  await fetchUpstreamModels(apiUrl, decrypt(saved?.api_key_encrypted || ''), res);
});

// 设置页"测试连接"：用表单里的临时地址/密钥验证可用性（保存前即可校验）。
// 密钥必须走 POST body——绝不能放 URL 查询串，否则会明文出现在反向代理访问日志、
// 浏览器网络面板的 URL 一栏等处。apiKey 为空则回退到已保存的 Key（改地址不重输密钥的场景）。
router.post('/models/test', async (req, res) => {
  const { apiUrl = '', apiKey = '' } = req.body || {};
  const url = apiUrl.trim();
  if (!url) return res.status(400).json({ message: '请填写 API 接口地址' });

  const saved = getLlmConfig(req.session.userId);
  const key = apiKey.trim() || decrypt(saved?.api_key_encrypted || '');
  await fetchUpstreamModels(url, key, res);
});

// 是否走 Ollama 原生 /api/chat 接口。Ollama 的 OpenAI 兼容层（/v1/chat/completions）
// 不支持 think 参数，思考型模型会把大段思维链堆在 reasoning 字段里拖慢首字节时间；
// 原生接口支持 think:false 直接跳过思考。
// 判定优先级：用户在设置里显式选择的 provided='ollama' > 端口号兜底猜测（:11434）。
const useOllamaNative = (config) =>
  config.provider === 'ollama' || /:11434\b/.test(config.api_url);

// 把 Ollama 原生 /api/chat 的 NDJSON chunk 转成前端已经在解析的 OpenAI SSE 格式，
// 这样协议差异完全在服务端吸收，前端 BaseProvider 不需要认识第二种格式。
const toSseChunk = (delta) =>
  `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`;

// 与前端 src/apis/providers/thinkTags.js 的 buildProviderThinkParams 保持一致——
// 服务端转发（backend 模式）同样需要给这几家平台拼上各自的思考开关参数，
// 两端各自独立维护是因为前后端是两套构建产物，没有共用模块的路径。
const buildProviderThinkParams = (apiUrl, thinkEnabled) => {
  if (/api\.anthropic\.com/.test(apiUrl)) {
    return thinkEnabled
      ? { thinking: { type: 'enabled', budget_tokens: 4096 } }
      : { thinking: { type: 'disabled' } };
  }
  if (/generativelanguage\.googleapis\.com/.test(apiUrl)) {
    return { reasoning_effort: thinkEnabled ? 'medium' : 'none' };
  }
  if (/dashscope\.aliyuncs\.com/.test(apiUrl)) {
    return { enable_thinking: thinkEnabled };
  }
  if (/open\.bigmodel\.cn/.test(apiUrl)) {
    return { thinking: { type: thinkEnabled ? 'enabled' : 'disabled' } };
  }
  return {};
};

async function proxyOpenAiCompat({ config, apiKey, messages, model, think, signal, res }) {
  let url = config.api_url.replace(/\/+$/, '');
  if (!url.endsWith('/chat/completions')) url = `${url}/chat/completions`;

  // 必须走 safeFetch：这里会把解密出的 Authorization 一并发往用户可控的地址，
  // 一旦地址指向内网，泄漏的不只是内网响应，还有上游 API Key。
  const upstream = await safeFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: model || config.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
      ...buildProviderThinkParams(config.api_url, Boolean(think)),
    }),
    signal,
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await readUpstreamError(upstream);
    res.status(upstream.status).json({ message: `上游返回错误 (${upstream.status}): ${detail}` });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    // 放在 nginx / 各类反代后面时，缺这个头会让整条 SSE 被缓冲成一次性返回，
    // 流式效果在生产环境静默失效（本地直连时看不出来）。
    'X-Accel-Buffering': 'no',
  });

  const reader = upstream.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      res.write(value); // 已经是目标 SSE 格式，原样透传
    }
    // 只有正常走完才在这里收尾；上游中途断线时让异常带着未收尾的 res 冒泡，
    // 由路由层补发错误块告知前端"回复不完整"（若在这 end 了就没法再写了）
    res.end();
  } finally {
    reader.releaseLock();
  }
}

async function proxyOllamaNative({ config, messages, model, think, signal, res }) {
  // apiUrl 通常配的是 OpenAI 兼容地址（.../v1），原生接口在同一 host 的 /api/chat 上
  const url = `${config.api_url.replace(/\/+$/, '').replace(/\/v1$/, '')}/api/chat`;

  const upstream = await safeFetch(url, {
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
    const detail = await readUpstreamError(upstream);
    res.status(upstream.status).json({ message: `上游返回错误 (${upstream.status}): ${detail}` });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    // 放在 nginx / 各类反代后面时，缺这个头会让整条 SSE 被缓冲成一次性返回，
    // 流式效果在生产环境静默失效（本地直连时看不出来）。
    'X-Accel-Buffering': 'no',
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
    // 同 proxyOpenAiCompat：正常走完才收尾，异常留给路由层补发错误块
    res.end();
  } finally {
    reader.releaseLock();
  }
}

// 转发聊天补全请求，流式把上游响应中转给前端（统一成 OpenAI SSE 格式）。
router.post('/chat/completions', chatRateLimiter, async (req, res) => {
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
  // 客户端断开连接（用户点了停止 / 关闭页面）时，中止对上游的请求，
  // 避免后端继续为一个没人接收的响应付费/占用连接。
  // 注意：必须监听 res 的 'close' 而不是 req 的——现代 Node 里 req 流在
  // express.json() 读完请求体后会立即触发 'close'，若据此 abort 会把正常请求
  // 误杀成 AbortError，导致响应永不 end、客户端一直挂起。res 'close' 才是真正的
  // 连接关闭信号；且仅在响应尚未正常结束时才中止。
  res.on('close', () => {
    if (!res.writableEnded) upstreamController.abort();
  });

  const proxy = useOllamaNative(config) ? proxyOllamaNative : proxyOpenAiCompat;

  try {
    await proxy({ config, apiKey, messages, model, think, signal: upstreamController.signal, res });
  } catch (error) {
    if (error.name === 'AbortError') return; // 客户端已断开，无需再响应
    if (!res.headersSent) {
      // 地址被安全策略拒绝是配置问题（400），与「上游连不上」（502）要分开，
      // 否则用户看到 502 只会反复重试，不会想到去改设置里的地址。
      if (error instanceof UpstreamUrlError) {
        return res.status(400).json({ message: `模型服务地址不被允许：${error.message}` });
      }
      res.status(502).json({ message: `无法连接模型服务：${error.message}` });
    } else {
      // 流已经开始，上游中途断了：不能再改状态码，也不能悄悄 end 让前端误以为
      // 回复正常结束。补发一个 OpenAI 流中错误的标准形态块（data: {"error":{...}}），
      // 前端识别后以错误气泡提示"回复不完整"，已收到的部分内容正常保留。
      console.error('上游流转发出错:', error);
      if (!res.writableEnded) {
        try {
          res.write(
            `data: ${JSON.stringify({ error: { message: `上游连接中断，回复不完整（${error.message}）` } })}\n\n`
          );
          res.write('data: [DONE]\n\n');
        } catch {
          // 写不进去说明连接也没了，无需处理
        }
        res.end();
      }
    }
  }
});

export default router;
