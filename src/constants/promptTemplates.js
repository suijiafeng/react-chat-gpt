// 空状态的内置 Prompt 模板（非演示模式）。
// 与演示模式的 DEMO_PROMPTS 不同：点击后只把模板文案填入输入框（prefill），
// 用户补全自己的内容后再发送，而不是直接发出去。
import { Languages, Code2, PenLine, Lightbulb } from 'lucide-react';

const TEMPLATES = [
  { id: 'translate', icon: Languages },
  { id: 'code', icon: Code2 },
  { id: 'polish', icon: PenLine },
  { id: 'brainstorm', icon: Lightbulb },
];

// 文案走 i18n（tpl.<id>.title / tpl.<id>.prompt），随语言切换
export const getPromptTemplates = (t) =>
  TEMPLATES.map(({ id, icon }) => ({
    id,
    icon,
    title: t(`tpl.${id}.title`),
    prompt: t(`tpl.${id}.prompt`),
    prefill: true,
  }));
