import React, { Suspense } from 'react';

// 重量级渲染器（react-markdown + highlight.js + KaTeX）拆分为独立异步 chunk。
// 本模块一加载就主动预取该 chunk，通常在第一条 AI 消息出现前就已就绪。
const loadContent = () => import('./MarkdownContent');
const MarkdownContent = React.lazy(loadContent);
loadContent();

// 加载期间的纯文本降级：使用与富文本渲染一致的排版（行高、换行），
// 切换到 Markdown 渲染时不跳版、不闪白。
const PlainText = ({ content }) => (
  <div className="whitespace-pre-wrap break-words text-inherit leading-7">{content}</div>
);

const MarkdownRenderer = ({ content }) => {
  if (!content) return null;

  return (
    <Suspense fallback={<PlainText content={content} />}>
      <MarkdownContent content={content} />
    </Suspense>
  );
};

export default React.memo(MarkdownRenderer);
