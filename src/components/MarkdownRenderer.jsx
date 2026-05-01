import React, { Suspense } from 'react';
import ErrorBoundary from './ErrorBoundary';

// 重量级渲染器（react-markdown + highlight.js + KaTeX）拆分为独立异步 chunk。
// 本模块一加载就主动预取该 chunk，通常在第一条 AI 消息出现前就已就绪。
const loadContent = () => import('./MarkdownContent');
const MarkdownContent = React.lazy(loadContent);
loadContent();

// 加载期间的纯文本降级：使用与富文本渲染一致的排版（行高、换行），
// 切换到 Markdown 渲染时不跳版、不闪白。
const PlainText = ({ content, isTyping }) => (
  <div className="whitespace-pre-wrap break-words text-inherit leading-7">
    {content}
    {isTyping && <span className="typing-cursor" aria-hidden="true" />}
  </div>
);

const MarkdownRenderer = ({ content, isTyping = false }) => {
  if (!content) return null;

  return (
    // 消息级错误边界：单条消息的 Markdown/公式/图表渲染崩溃时降级为纯文本，
    // 不拖垮整个会话页；resetKey=content 让流式下一个 chunk 到达时自动重试
    <ErrorBoundary
      resetKey={content}
      fallback={<PlainText content={content} isTyping={isTyping} />}
    >
      <Suspense fallback={<PlainText content={content} isTyping={isTyping} />}>
        <MarkdownContent content={content} isTyping={isTyping} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default React.memo(MarkdownRenderer);
