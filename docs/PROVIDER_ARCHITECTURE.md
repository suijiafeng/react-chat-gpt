# 模型接入架构：Provider 层设计

本文档描述项目如何对接大模型 API，以及新增一种模型服务时该怎么做。

项目定位：**只做前端体验，用 demo 模式兜底，尽可能兼容各种大模型 / 后端接口**。这份文档就是围绕这个定位来组织的——先说清楚现状能覆盖什么、不能覆盖什么，再给出扩展路径。

## 1. 分层结构

```
组件层 (ChatInterface / useChat)
        │  发送: { messages, model, session_id, chat_id, ... }
        ▼
apis/chat.js  ── generateChatCompletion(params, callback, signal)
        │  只做一件事：选出当前该用哪个 provider
        ▼
store/llmConfig.js ── resolveProviderName()
        │  读 localStorage，决定 'demo' | 'custom' | 'ollama'
        ▼
apis/providers/index.js ── providerRegistry.getProvider(name)
        │
        ├── DemoProvider    （src/apis/providers/demo.js）
        ├── OpenAIProvider  （src/apis/providers/openai.js）  ← "custom"
        └── OllamaProvider  （src/apis/providers/ollama.js）
                │  都继承同一个基类
                ▼
        BaseProvider（src/apis/providers/base.js）
                │  提供 parseStream()：健壮的 SSE 增量解析
```

**关键设计原则：组件层完全不知道具体 provider 是谁。** `useChat.js` 只调用 `generateChatCompletion`，剩下的选择、鉴权、协议差异全部封装在 provider 内部。这意味着：新增一种模型服务，理论上只需要新增一个 provider 文件 + 在 registry 里注册一行，不需要碰组件、hooks、UI。

## 2. 各文件职责

| 文件 | 职责 |
|---|---|
| [`store/llmConfig.js`](../src/store/llmConfig.js) | 配置的唯一数据源：读写 `localStorage`，提供 `useSyncExternalStore` 订阅，判断当前该用哪个 provider（`resolveProviderName`）、该用哪个模型（`resolveCurrentModel`）。演示模式判断（`isDemoMode`）也收敛在这里。 |
| [`apis/chat.js`](../src/apis/chat.js) | 面向组件层的入口函数 `generateChatCompletion`。拿到 provider 后统一 try/catch，网络错误转成一条对用户可读的消息塞进回调，而不是让异常裸抛到 UI。 |
| [`apis/providers/index.js`](../src/apis/providers/index.js) | `ProviderRegistry`：`{ name → 实例 }` 的映射表，找不到时兜底回退到 `demo`。**新增 provider 的注册点**。 |
| [`apis/providers/base.js`](../src/apis/providers/base.js) | 抽象基类。子类必须实现 `complete(params, callback, signal)`。提供 `parseStream()` 工具方法——处理 SSE 分片/粘包、`data: [DONE]` 结束标记、末尾残余 buffer，这是最容易写错的部分，新 provider 应尽量复用它而不是自己重写。 |
| [`apis/providers/demo.js`](../src/apis/providers/demo.js) | 兜底 provider。不发任何网络请求，从本地素材库里取一段文本，逐字符 + 标点停顿模拟真实打字节奏。**任何配置缺失或用户主动选择时的安全网**。 |
| [`apis/providers/openai.js`](../src/apis/providers/openai.js) | 覆盖面最广的一个：只要是 OpenAI 兼容协议（`/chat/completions` + SSE `data: {choices[0].delta.content}`），都用这一个 provider 覆盖——DeepSeek、智谱、Moonshot、通义、OpenRouter 等本质上都是这个协议的方言。 |
| [`apis/providers/ollama.js`](../src/apis/providers/ollama.js) | Ollama 原生协议（NDJSON，非 SSE）。同时也是**当前唯一"经后端转发"的路径**——它打的是 `OLLAMA_API_BASE_URL`（即 `{WEBUI_BASE_URL}/ollama`），预期背后有一个 open-webui 风格的后端在转发。 |

## 3. `complete()` 契约

所有 provider 必须实现同一个签名：

```js
async complete(params, callback, signal)
```

- **`params`**：`{ messages, model, stream, options, session_id, chat_id, id }`。`messages` 是标准 `{ role, content }[]` 格式，发送前已经过 [`utils/context.js`](../src/utils/context.js) 的 token 截断。
- **`callback(chunk)`**：每收到一段增量文本就调用一次；生成结束时调用 `callback('[DONE]')`。这是流式渲染能工作的唯一契约，无论底层协议是 SSE、NDJSON 还是别的，provider 必须把它翻译成这个统一形式。
- **`signal`**：`AbortController.signal`，用户点"停止"或切换会话时会被 abort。provider 内部的网络请求和循环都要能响应它（抛 `AbortError`），[`useChat.js`](../src/hooks/useChat.js) 依赖这个行为来实现"停止后保留已生成内容"。

组件层完全不用关心这三个协议怎么实现——它只认这一个契约。

## 4. 现状覆盖了什么，没覆盖什么

**已覆盖**（对应"兼容各种大模型"这个目标）：
- 所有 OpenAI 协议兼容的服务商（覆盖面最广，一个 provider 通吃）
- Ollama 原生协议
- 无配置时的 demo 兜底

**未覆盖**（这是当前架构相对目标的主要缺口）：
- **Anthropic（Claude）原生 API**：请求体结构和流式事件（`content_block_delta` 等）都不是 OpenAI 格式，需要新增一个 provider，不能靠现有的 OpenAIProvider 硬套
- **Gemini 原生 API**：同理，需要独立 provider
- **"经后端转发"作为一等公民**：目前只有 Ollama provider 走后端代理路径；如果目标包含"更好地对接后端接口"，直连模型商 API Key 明文存前端并不是长期方案——更合理的架构是前端只认后端签发的会话 token，真正的 Key 由后端持有。这需要一个新的 `backend` provider，走 `WEBUI_BASE_URL` 而不是各家模型商域名。
- **多模态输入**（图片/文件）：`messages` 目前只有纯文本 `content` 字段，不同厂商的图片输入字段格式不同（OpenAI 用 `content: [{type: 'image_url', ...}]`，Anthropic 用 `content: [{type: 'image', source: {...}}]`），这个契约层还没设计。

## 5. 新增一个 Provider 的步骤

以新增 Anthropic 为例，说明扩展路径（暂不实现）：

1. **新建 `apis/providers/anthropic.js`**，继承 `BaseProvider`，实现 `complete()`：
   - 请求体需要转换：`messages` 里的 `system` 角色要单独抽出成顶层 `system` 字段（Anthropic 协议要求）
   - 流式响应不是标准 SSE 的 `data: {...}` 一行一个完整 JSON，而是多种 event 类型（`message_start`/`content_block_delta`/`message_stop`），`parseStream()` 的 `dataParser` 回调机制可以复用，但可能需要新增一个专门的解析辅助函数，或者在 provider 内部自己处理这部分（不勉强复用 SSE 通用解析器）
2. **在 `apis/providers/index.js` 里注册**：`providers: { ..., anthropic: new AnthropicProvider() }`
3. **在 `store/llmConfig.js` 的 `resolveProviderName()` 里加一个可选分支**（如果需要作为独立可选项，而不是塞进 `custom`）
4. **在 `SettingsModal.jsx` 里加一个 provider 选项**，可能需要区分"Anthropic 原生"和"OpenAI 兼容"两种模式，因为字段名不同（Anthropic 官方 API Key 前缀是 `sk-ant-`）
5. **多模态支持是独立的一步**：需要先扩展 `ChatInput` 支持图片上传，`useChat.js` 里 messages 结构要能承载图片，再由各 provider 各自转换成自己的格式

新增"后端代理"provider 的路径类似，但更简单——不需要处理厂商协议差异（后端已经统一了），只需要对接后端自己定义的接口格式，且不需要在前端存储真实 API Key。

## 6. 与"demo 兜底"的关系

`resolveProviderName()` 的优先级设计是这份架构里最容易被忽略、但对"体验"影响最大的一点：

```
用户在设置里显式选过 (custom/demo) → 尊重选择
      │ 否则
未配置 + 演示模式开关打开           → 落到 demo
      │ 否则
未配置 + 非演示模式                 → 落到部署时的默认 provider
```

新增任何 provider 时，都不需要改这个优先级逻辑——只要新 provider 走的是"用户在设置里显式选择"这条路径，兜底行为自动继承。这也是为什么"先做架构文档化"是对的：只要这条优先级链路稳定，后面加多少个 provider 都不会破坏"零配置先用 demo 体验"这个底线体验。
