import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlightLite from './markdown/rehypeHighlightLite';
import MermaidBlock from './markdown/MermaidBlock';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
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
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // 代码块跟随主题：浅色下是浅灰底，深色下用锌黑，不用一块突兀的黑板。
  const surface = isDark
    ? 'bg-[#1e1e1e] text-[#d4d4d4] border-white/10'
    : 'bg-[#f6f8fa] text-[#24292e] border-black/10';
  const chrome = isDark
    ? 'bg-[#2d2d2d] text-gray-400 hover:text-white'
    : 'bg-[#eaeef2] text-gray-500 hover:text-gray-900';

  const lineCount = codeText.split('\n').length;
  const collapsible = lineCount > CODE_COLLAPSE_LINES;
  const collapsed = collapsible && !expanded;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`my-4 min-w-0 max-w-full overflow-hidden rounded-lg border font-mono text-sm ${surface}`}>
      <div className={`flex items-center justify-between px-3 py-1.5 text-[12px] select-none ${chrome}`}>
        <span className="font-medium tracking-normal">{lang || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 transition-colors duration-150 ease-out"
        >
          {copied ? t('codeCopied') : t('copy')}
        </button>
      </div>
      <div
        className={`min-w-0 overflow-x-auto p-4 leading-6 ${collapsed ? 'max-h-[26rem] overflow-y-hidden' : ''}`}
      >
        <pre className="!m-0 w-max min-w-full !bg-transparent !p-0">{children}</pre>
      </div>
      {collapsible && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`flex w-full items-center justify-center gap-1 px-3 py-1.5 text-[12px] transition-colors duration-150 ease-out select-none tabular-nums ${chrome}`}
        >
          {collapsed ? t('codeExpand', { n: lineCount }) : t('codeCollapse')}
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className={`transition-transform duration-150 ease-out ${collapsed ? '' : 'rotate-180'}`}
          />
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

// 分隔线和底纹跟文字走同一套中性色。Tailwind 3.4 不会生成
// border-current/10、bg-current/[0.09] 这类 current 透明度，暗色会掉回亮灰。
// 主题类是 .dark-theme（见 tailwind.config.js），dark: 前缀会跟着应用内主题走。
const line = 'border-black/10 dark:border-white/10';
const lineStrong = 'border-black/30 dark:border-white/30';
const wash = 'bg-black/[0.05] dark:bg-white/10';
const washSoft = 'bg-black/[0.03] dark:bg-white/[0.06]';
const washHover = 'hover:bg-black/[0.03] dark:hover:bg-white/[0.05]';

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
      <code className={`rounded-md px-1.5 py-0.5 font-mono text-[0.9em] text-inherit ${wash}`}>
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
        className="text-[#3b82f6] hover:underline underline-offset-2 break-words"
      >
        {children}
      </a>
    );
  },
  h1: ({ children }) => (
    <h1 className={`mt-5 mb-3 border-b pb-2 text-2xl font-semibold leading-snug tracking-normal text-inherit ${line}`}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className={`mt-5 mb-3 border-b pb-2 text-xl font-semibold leading-snug tracking-normal text-inherit ${line}`}>
      {children}
    </h2>
  ),
  h3: ({ children }) => <h3 className="text-lg font-semibold leading-snug tracking-normal mt-4 mb-2 text-inherit">{children}</h3>,
  h4: ({ children }) => <h4 className="text-base font-semibold mt-3 mb-2 text-inherit">{children}</h4>,
  h5: ({ children }) => <h5 className="text-sm font-semibold tracking-normal mt-3 mb-2 text-inherit">{children}</h5>,
  h6: ({ children }) => (
    <h6 className="text-sm font-semibold tracking-normal mt-3 mb-2 opacity-70 text-inherit">
      {children}
    </h6>
  ),
  p: ({ children, node }) => {
    const showCursor = node?.properties?.['data-last-paragraph'] === 'true';
    return (
      <p className="leading-7 my-2">
        {children}
        {showCursor && <span className="typing-cursor" aria-hidden="true" />}
      </p>
    );
  },
  hr: () => <hr className={`my-6 border-t ${line}`} />,
  blockquote: ({ children }) => (
    <blockquote className={`my-3 border-l pl-3 leading-7 text-inherit ${lineStrong}`}>
      {children}
    </blockquote>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-6 marker:text-black/40 dark:marker:text-white/40">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-6 marker:text-black/40 dark:marker:text-white/40">{children}</ol>
  ),
  li: ({ children }) => <li className="pl-1 leading-7">{children}</li>,
  table: ({ children }) => (
    <div className={`my-4 min-w-0 max-w-full overflow-x-auto rounded-lg border ${line}`}>
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className={washSoft}>{children}</thead>,
  tr: ({ children }) => (
    <tr className={`border-b last:border-b-0 ${line} ${washHover}`}>
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className={`border-r px-4 py-2 text-sm font-semibold last:border-r-0 ${line}`}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className={`border-r px-4 py-2 align-top text-sm last:border-r-0 ${line}`}>
      {children}
    </td>
  ),
  strong: ({ children }) => <strong className="font-semibold text-inherit">{children}</strong>,
  em: ({ children }) => <em className="italic text-inherit">{children}</em>,
  del: ({ children }) => <del className="opacity-60">{children}</del>,
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt}
      className={`my-2 max-w-full rounded-lg border ${line}`}
      loading="lazy"
    />
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
      className="markdown-body min-w-0 max-w-full break-words text-inherit leading-7"
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
