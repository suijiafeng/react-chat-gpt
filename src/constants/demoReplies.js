/**
 * 演示模式下的 AI 对话回复集合
 *
 * 分两层：
 * 1. TOPIC_REPLIES —— 按关键词匹配的主题回复（使用教程、提示词、代码、Markdown 演示等），
 *    让演示模式看起来"听得懂"常见问题；
 * 2. DEMO_REPLIES —— 未命中任何主题时的通用兜底回复，随机选取。
 *
 * 回复内容使用 Markdown 编写，可以顺带展示消息渲染能力（表格、代码块、列表等）。
 */

// === 主题回复：关键词命中即返回对应内容 ===
const TOPIC_REPLIES = [
  {
    // 使用教程
    keywords: ['教程', '怎么用', '如何使用', '使用方法', '上手', '指南', '帮助', 'help', '怎么开始'],
    replies: [
      `很高兴带你快速上手！这个应用的使用方式和 ChatGPT 基本一致：

## 🚀 快速开始

1. **发送消息**：在底部输入框输入内容，按 \`Enter\` 发送（\`Shift + Enter\` 换行）
2. **新建对话**：点击侧边栏顶部的"新对话"按钮
3. **切换历史会话**：所有会话都保存在浏览器本地（IndexedDB），点击侧边栏即可切换
4. **中断回复**：AI 输出过程中点击输入框右侧的停止按钮

## ⚙️ 进阶功能

| 功能 | 位置 | 说明 |
| --- | --- | --- |
| 切换模型 | 顶部模型选择器 | 演示模式 / Ollama / 自定义 API |
| 深色模式 | 设置弹窗 | 跟随系统或手动切换 |
| 重新生成 | 消息下方按钮 | 对最后一条回复不满意时使用 |
| 编辑重发 | 用户消息旁 | 修改已发送的问题并重新提问 |

当前是**演示模式**，接入 Ollama 或 OpenAI 兼容接口后即可获得真实 AI 回复。`,
      `好的，给你一份精简版使用说明：

- **对话**：底部输入框发消息，支持多轮上下文
- **会话管理**：左侧边栏可以新建、切换、删除会话，数据保存在浏览器本地
- **模型配置**：打开设置弹窗，可以配置 Ollama 地址或 OpenAI 兼容 API 密钥
- **主题与语言**：设置里支持深色/浅色主题和中英文切换

> 💡 提示：演示模式下的回复是预设内容，配置真实后端后这里就会是真正的 AI 在回答了。`,
    ],
  },
  {
    // 提示词技巧
    keywords: ['提示词', 'prompt', '提问技巧', '怎么问', '怎么提问'],
    replies: [
      `写好提示词的核心是**把模糊的期望变成明确的要求**。分享几个实用模板：

## ✍️ 通用结构

\`\`\`text
角色 + 任务 + 上下文 + 输出格式
\`\`\`

## 📋 常用模板

**1. 角色扮演**
> 你是一位资深前端工程师，请帮我 Review 下面这段 React 代码，指出性能问题。

**2. 分步思考**
> 请一步一步分析：为什么这个 useEffect 会造成无限循环？

**3. 指定格式**
> 用表格对比 Vue 和 React 的差异，包含：学习曲线、生态、性能三个维度。

**4. 给出示例（Few-shot）**
> 参考这个风格帮我再写三条文案：「简约不简单，设计有态度」

## 💡 小技巧

- 提供背景信息越具体，回答质量越高
- 复杂任务拆成多轮对话，逐步细化
- 对结果不满意时，直接说"更简洁一点"或"换个角度"`,
    ],
  },
  {
    // 功能 / 项目介绍
    keywords: ['功能', '能做什么', '会什么', '介绍一下', '这个项目', '技术栈', '架构'],
    replies: [
      `这是一个用 **React + Vite** 构建的 ChatGPT 风格聊天应用，主要功能：

## ✨ 核心功能

- 🔄 **流式输出**：打字机效果，支持中断和续写
- 💬 **多会话管理**：会话持久化到 IndexedDB，刷新不丢失
- 🧠 **思考过程展示**：兼容 \`reasoning_content\` 和 \`<think>\` 标签
- 🎨 **深色 / 浅色主题**、中英文国际化
- 📝 **Markdown 渲染**：代码高亮、表格、列表全支持

## 🔌 多 Provider 架构

| Provider | 说明 |
| --- | --- |
| Demo | 前端演示模式（当前） |
| Ollama | 本地大模型 |
| Custom | 任意 OpenAI 兼容 API |
| Backend | 自建后端服务 |

想体验真实 AI？打开设置弹窗配置一个 Provider 即可。`,
    ],
  },
  {
    // 自我介绍 / 打招呼
    keywords: ['你是谁', '你好', '您好', 'hello', 'hi', '在吗', '你叫什么'],
    replies: [
      `你好！👋 我是这个演示项目里的 AI 助手。

目前运行在**演示模式**下——我的回复是预设内容，不是真实的模型推理。不过界面上你看到的一切（流式打字、会话管理、Markdown 渲染、主题切换）都是真实实现的功能。

你可以试着问我：
- "这个项目怎么使用？"
- "给我一些提示词技巧"
- "写一个 React 组件示例"
- "用表格演示一下 Markdown"`,
      `嗨，很高兴见到你！我是演示模式下的虚拟助手。

虽然我不能真正"思考"，但我认识不少关键词——问我**使用教程**、**提示词**、**代码示例**或者**项目功能**，我都能给出像样的回答。配置真实后端后，这里就会换成真正的 AI 了。`,
    ],
  },
  {
    // Markdown 渲染演示
    keywords: ['markdown', '表格', '格式', '渲染', '列表', '演示一下'],
    replies: [
      `没问题，来一份 Markdown 渲染能力演示：

## 标题与强调

支持 **加粗**、*斜体*、~~删除线~~ 和 \`行内代码\`。

## 表格

| 语法 | 效果 | 常用度 |
| --- | --- | --- |
| \`**bold**\` | **加粗** | ⭐⭐⭐ |
| \`> quote\` | 引用块 | ⭐⭐ |
| \`\\\`code\\\`\` | 行内代码 | ⭐⭐⭐ |

## 列表

1. 有序列表第一项
2. 第二项
   - 嵌套无序列表
   - 支持多级缩进

## 引用与代码块

> 这是一个引用块，适合放提示信息。

\`\`\`css
.chat-message {
  border-radius: 12px;
  padding: 12px 16px;
}
\`\`\`

以上全部由消息组件实时渲染 ✅`,
    ],
  },
  {
    // 代码能力演示
    keywords: ['代码', '编程', '写一个', '写个', '函数', '组件', 'react', 'python', 'js', 'javascript', '算法'],
    replies: [
      `好的！这里是一个简洁的 React 计数器组件示例：

\`\`\`jsx
import { useState, useCallback } from 'react';

function Counter({ initial = 0, step = 1 }) {
  const [count, setCount] = useState(initial);

  const increment = useCallback(() => setCount((c) => c + step), [step]);
  const decrement = useCallback(() => setCount((c) => c - step), [step]);

  return (
    <div className="counter">
      <button onClick={decrement}>-</button>
      <span>{count}</span>
      <button onClick={increment}>+</button>
    </div>
  );
}

export default Counter;
\`\`\`

**要点说明：**

1. \`useState\` 用函数式更新 \`(c) => c + step\`，避免闭包捕获旧值
2. \`useCallback\` 缓存回调，配合 \`React.memo\` 的子组件可减少重渲染
3. 通过 props 暴露 \`initial\` 和 \`step\`，提高组件复用性

> ⚠️ 演示模式下代码是预设示例。接入真实模型后，可以按你的具体需求生成代码。`,
      `来一个经典算法演示——用 JavaScript 实现防抖（debounce）：

\`\`\`javascript
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// 使用示例：搜索框输入停止 500ms 后才发请求
const handleSearch = debounce((keyword) => {
  console.log('搜索:', keyword);
}, 500);
\`\`\`

**防抖 vs 节流：**

| | 防抖 debounce | 节流 throttle |
| --- | --- | --- |
| 行为 | 停止触发后才执行 | 固定间隔执行一次 |
| 场景 | 搜索联想、窗口 resize | 滚动加载、按钮防连点 |`,
    ],
  },
  {
    // 写作演示
    keywords: ['写一首', '写首', '诗', '文案', '故事', '写作', '标题', '起个名'],
    replies: [
      `好的，即兴来一首关于写代码的小诗：

> **《深夜编译》**
>
> 屏幕微光映夜色，
> 指尖敲落千行诗。
> 一杯咖啡陪断点，
> Bug 修尽天欲晓时。

写作类任务是大语言模型的强项——文案、诗歌、故事、标题优化都不在话下。演示模式只能给你这首预设的小诗，接入真实模型后可以按任意主题、风格、字数要求创作。✨`,
    ],
  },
  {
    // 设置 / 主题 / 模型
    keywords: ['设置', '主题', '深色', '暗色', '夜间', '切换模型', '配置', 'ollama', 'api'],
    replies: [
      `关于设置与配置：

## 🎨 主题切换

打开**设置弹窗**即可在深色 / 浅色主题之间切换，偏好会保存在本地。

## 🔌 接入真实模型

1. **Ollama（本地）**：在设置中填入 Ollama 服务地址（默认 \`http://localhost:11434\`），选择已下载的模型
2. **OpenAI 兼容 API**：填入 Base URL 和 API Key，支持 OpenAI、DeepSeek、Moonshot 等任何兼容接口
3. 配置完成后可以点击**测试连接**验证可用性

配置好后在顶部模型选择器切换，即可告别演示模式，获得真实 AI 回复。`,
    ],
  },
];

// === 通用兜底回复（未命中主题时随机选取）===
const DEMO_REPLIES = [
  '您好！我是演示模式下的 AI 助手。目前项目运行在本地，消息会保存到浏览器的 IndexedDB 中，刷新页面后仍可查看历史记录。',
  '这是一个前端演示项目，支持多会话管理、深色/浅色主题切换以及流式打字效果。如需接入真实模型，配置后端服务即可。',
  '当然，我很乐意帮您解答！不过当前处于演示模式，所有回复均为预设内容。接入 Ollama 或 OpenAI 兼容接口后即可获得真实响应。\n\n你可以试试问我：**"这个项目怎么使用？"** 或 **"写一个 React 组件"**，我准备了更详细的回答。',
  '感谢您的提问。演示模式下我无法真正理解您的输入，但项目的所有 UI 交互——包括消息流式输出、会话切换、历史记录——均已完整实现。',
  '明白了！这个功能在接入真实后端后可以正常使用。目前您看到的流式打字效果是前端模拟的，速度和节奏与真实模型输出基本一致。',
  '欢迎使用 React Chat GPT 演示项目！试着问我 **"使用教程"**、**"提示词技巧"** 或 **"演示一下 Markdown"**，可以看到更丰富的回复效果。',
  '这是个好问题！可惜演示模式下我只能给出预设回复 😅 不过你可以在设置中配置 Ollama 或任意 OpenAI 兼容 API，之后我就能真正回答你了。',
  '收到！虽然我现在只是"照本宣科"的演示助手，但这个界面支持完整的 Markdown 渲染——问我 **"写一段代码"** 试试看代码高亮效果？',
  '嗯，让我想想……好吧，演示模式下我确实想不出来 🤖 但我可以告诉你：这个项目支持多会话、流式输出、思考过程展示和主题切换，欢迎逐一体验。',
  '感谢你的耐心！如果想看更"聪明"的回复，可以问我这几个话题：**使用教程**、**提示词**、**项目功能**、**代码示例**——这些我都有备而来。',
];

/**
 * 根据最后一条用户消息生成演示回复：
 * 优先按关键词匹配主题回复，未命中则从通用池随机选取
 * @param {Array} messages - 消息数组
 * @returns {string} 演示回复
 */
export const buildDemoReply = (messages = []) => {
  const lastUserMessage =
    [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const text = lastUserMessage.toLowerCase();

  for (const topic of TOPIC_REPLIES) {
    if (topic.keywords.some((kw) => text.includes(kw))) {
      const idx = Math.floor(Math.random() * topic.replies.length);
      return topic.replies[idx];
    }
  }

  const turn = messages.filter((m) => m.role === 'user').length;
  // 基于对话轮次和随机数混合，实现更随机的效果
  const seed = (turn * 73 + Date.now()) % DEMO_REPLIES.length;
  return DEMO_REPLIES[seed];
};

/**
 * 空会话欢迎页的默认提示词卡片（点击直接发送，均能命中主题回复）
 */
export const DEMO_PROMPTS = [
  { icon: '📖', title: '使用教程', prompt: '这个项目怎么使用？给我一份使用教程' },
  { icon: '✍️', title: '提示词技巧', prompt: '分享一些好用的提示词技巧' },
  { icon: '💻', title: '代码示例', prompt: '写一个 React 计数器组件' },
  { icon: '📝', title: 'Markdown 演示', prompt: '用表格和代码块演示一下 Markdown 渲染' },
];
