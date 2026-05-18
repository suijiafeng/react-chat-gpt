import React, { Suspense, useMemo, useRef } from 'react';
import ErrorBoundary from './ErrorBoundary';
import { splitStableMarkdown } from '../utils/streamingMarkdown';

// 重量级渲染器（react-markdown + highlight.js + KaTeX）拆分为独立异步 chunk。
// 本模块一加载就主动预取该 chunk，通常在第一条 AI 消息出现前就已就绪。
const loadContent = () => import('./MarkdownContent');
const MarkdownContent = React.lazy(loadContent);
loadContent();

// 超过该长度的流式消息启用"稳定前缀 + 活跃尾部"分段渲染：
// 前缀字符串引用保持稳定，React.memo 直接跳过其重解析，
// 每次流式刷新只重新解析很短的尾部，避免全文重解析的平方级开销
const SPLIT_THRESHOLD = 1500;

// 加载期间的纯文本降级：使用与富文本渲染一致的排版（行高、换行），
// 切换到 Markdown 渲染时不跳版、不闪白。
const PlainText = ({ content, isTyping }) => (
  <div className="whitespace-pre-wrap break-words text-inherit leading-7">
    {content}
    {isTyping && <span className="typing-cursor" aria-hidden="true" />}
  </div>
);

const MarkdownRenderer = ({ content, isTyping = false }) => {
  // 缓存上一次的稳定前缀：splitStableMarkdown 每次 slice 出的是新字符串实例，
  // 值相同就复用旧实例，让 memo 的 Object.is 比较以引用相等直接命中
  const lastStableRef = useRef('');

  const { stable, tail } = useMemo(() => {
    if (!isTyping || !content || content.length < SPLIT_THRESHOLD) {
      return { stable: '', tail: content || '' };
    }
    return splitStableMarkdown(content);
  }, [content, isTyping]);

  if (!content) return null;

  const stableStr =
    stable === lastStableRef.current ? lastStableRef.current : (lastStableRef.current = stable);

  return (
    // 消息级错误边界：单条消息的 Markdown/公式/图表渲染崩溃时降级为纯文本，
    // 不拖垮整个会话页；resetKey=content 让流式下一个 chunk 到达时自动重试
    <ErrorBoundary
      resetKey={content}
      fallback={<PlainText content={content} isTyping={isTyping} />}
    >
      <Suspense fallback={<PlainText content={content} isTyping={isTyping} />}>
        {stableStr ? (
          <>
            {/* 稳定前缀：新块完成前内容不变，memo 命中，零重解析 */}
            <MarkdownContent content={stableStr} isTyping={false} />
            <MarkdownContent content={tail} isTyping={isTyping} />
          </>
        ) : (
          <MarkdownContent content={tail} isTyping={isTyping} />
        )}
      </Suspense>
    </ErrorBoundary>
  );
};

export default React.memo(MarkdownRenderer);
