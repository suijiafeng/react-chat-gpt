import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlightLite from './markdown/rehypeHighlightLite';
import MermaidBlock from './markdown/MermaidBlock';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

const remarkMarkLastParagraph = () => (tree) => {
  const paragraphs = [];
  const visitNode = (node) => {
    if (!node) return;
    if (node.type === 'paragraph') paragraphs.push(node);
    if (Array.isArray(node.children)) node.children.forEach(visitNode);
  };
  visitNode(tree);
  const lastParagraph = paragraphs[paragraphs.length - 1];
  if (lastParagraph) {
    lastParagraph.data = {
      ...lastParagraph.data,
      hProperties: {
        ...lastParagraph.data?.hProperties,
        'data-last-paragraph': 'true',
      },
    };
  }
};

// 长代码块默认折叠的行数阈值
const CODE_COLLAPSE_LINES = 30;

// 带复制按钮的代码块组件；超长代码默认折叠，可展开
const CodeBlock = React.memo(({ lang, codeText, children }) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const lineCount = codeText.split('\n').length;
  const collapsible = lineCount > CODE_COLLAPSE_LINES;
  const collapsed = collapsible && !expanded;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] text-xs text-gray-400 select-none">
        <span className="uppercase font-semibold">{lang || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          {copied ? 'Copied!' : 'Copy code'}
        </button>
      </div>
      <div
        className={`overflow-x-auto p-4 leading-6 ${collapsed ? 'max-h-[26rem] overflow-y-hidden' : ''}`}
      >
        <pre className="!bg-transparent !p-0 !m-0">{children}</pre>
      </div>
      {collapsible && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full px-4 py-1.5 bg-[#2d2d2d] text-xs text-gray-400 hover:text-white transition-colors text-center select-none"
        >
          {collapsed ? `展开全部 ${lineCount} 行 ▾` : '收起 ▴'}
        </button>
      )}
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

// 从 React 元素树中提取纯文本（供复制按钮使用）
function extractText(node) {
  if (node == null) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (node.props?.children) return extractText(node.props.children);
  return '';
}

// pre 处理器需要感知 isTyping（mermaid 流式中先展示源码），
// 但 components 对象的引用必须稳定——否则每次流式刷新都会导致代码块子树重挂载。
// 因此用工厂函数生成 typing / static 两套稳定的组件映射。
const buildPre = (isTyping) =>
  function Pre({ children }) {
    const codeEl = Array.isArray(children) ? children[0] : children;
    const className = codeEl?.props?.className || '';
    const lang = /language-(\w+)/.exec(className)?.[1] || '';
    if (lang === 'mermaid') {
      return <MermaidBlock code={extractText(codeEl)} isTyping={isTyping} />;
    }
    return (
      <CodeBlock lang={lang} codeText={extractText(codeEl)}>
        {children}
      </CodeBlock>
    );
  };

const components = {
  // 行内代码（块级代码由上面的 `pre` 处理，保留 hljs 高亮类名）
  code({ className, children, ...props }) {
    if (className?.includes('language-') || className?.includes('hljs')) {
      return (
        <code className={`${className} block`} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-black/[0.06] dark:bg-white/[0.08] px-1.5 py-0.5 rounded text-sm font-mono text-[#e06c75] dark:text-[#f87171]">
        {children}
      </code>
    );
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-500 dark:text-blue-400 hover:underline"
      >
        {children}
      </a>
    );
  },
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold my-4 pb-2 border-b border-gray-200 dark:border-gray-800 text-inherit">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-2xl font-bold my-3 pb-1 border-b border-gray-200/50 dark:border-gray-800/50 text-inherit">
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="text-xl font-bold my-2 text-inherit">{children}</h3>,
  h4: ({ children }) => <h4 className="text-lg font-semibold my-2 text-inherit">{children}</h4>,
  h5: ({ children }) => <h5 className="text-base font-semibold my-2 text-inherit">{children}</h5>,
  h6: ({ children }) => <h6 className="text-sm font-semibold my-2 text-inherit">{children}</h6>,
  p: ({ children, node }) => {
    const showCursor = node?.properties?.['data-last-paragraph'] === 'true';
    return (
      <p className="leading-7 my-2">
        {children}
        {showCursor && <span className="typing-cursor" aria-hidden="true" />}
      </p>
    );
  },
  hr: () => <hr className="my-6 border-t border-gray-200 dark:border-gray-800" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-gray-300 dark:border-gray-700 pl-4 py-1.5 my-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-r italic text-gray-600 dark:text-gray-300 text-sm">
      {children}
    </blockquote>
  ),
  ul: ({ children }) => <ul className="list-disc pl-6 space-y-1 my-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 space-y-1 my-2">{children}</ol>,
  li: ({ children }) => <li className="leading-7">{children}</li>,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-black/[0.03] dark:bg-white/[0.03]">{children}</thead>
  ),
  tr: ({ children }) => (
    <tr className="border-b border-gray-200 dark:border-gray-800 last:border-b-0 hover:bg-black/[0.01] dark:hover:bg-white/[0.01]">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2 text-sm font-bold border-r border-gray-200 dark:border-gray-800 last:border-r-0">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 text-sm border-r border-gray-200 dark:border-gray-800 last:border-r-0">
      {children}
    </td>
  ),
  del: ({ children }) => <del className="opacity-70">{children}</del>,
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="max-w-full rounded-lg my-2" loading="lazy" />
  ),
};

// typing / static 两套组件映射，模块级只创建一次，保证引用稳定
const componentsTyping = { ...components, pre: buildPre(true) };
const componentsStatic = { ...components, pre: buildPre(false) };

// 空内容守卫在 MarkdownRenderer 里，这里只负责渲染
const MarkdownContent = ({ content, isTyping }) => {
  const remarkPlugins = isTyping
    ? [remarkGfm, remarkMath, remarkMarkLastParagraph]
    : [remarkGfm, remarkMath];

  return (
    <div
      className="markdown-body space-y-1 text-inherit leading-7 break-words"
    >
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={[rehypeKatex, rehypeHighlightLite]}
        components={isTyping ? componentsTyping : componentsStatic}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default React.memo(MarkdownContent);
