import React, { useState } from 'react';

// Copyable CodeBlock component
const CodeBlock = React.memo(({ lang, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
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
      <div className="overflow-x-auto p-4 leading-6">
        <pre><code className="block">{code}</code></pre>
      </div>
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';

// Helper to parse inline elements: bold, italic, inline code, inline math, links
function parseInline(text) {
  if (!text) return '';

  let tokens = [{ type: 'text', value: text }];

  // 1. Inline code: `code`
  tokens = tokens.flatMap(token => {
    if (token.type !== 'text') return token;
    const parts = token.value.split(/(`[^`]+`)/g);
    return parts.map(part => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return { type: 'code', value: part.slice(1, -1) };
      }
      return { type: 'text', value: part };
    });
  });

  // 2. Inline math: $math$
  tokens = tokens.flatMap(token => {
    if (token.type !== 'text') return token;
    const parts = token.value.split(/(\$[^$]+\$)/g);
    return parts.map(part => {
      if (part.startsWith('$') && part.endsWith('$')) {
        return { type: 'math', value: part.slice(1, -1) };
      }
      return { type: 'text', value: part };
    });
  });

  // 3. Bold: **bold**
  tokens = tokens.flatMap(token => {
    if (token.type !== 'text') return token;
    const parts = token.value.split(/(\*\*[^*]+\*\*)/g);
    return parts.map(part => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return { type: 'bold', value: part.slice(2, -2) };
      }
      return { type: 'text', value: part };
    });
  });

  // 4. Italic: *italic*
  tokens = tokens.flatMap(token => {
    if (token.type !== 'text') return token;
    const parts = token.value.split(/(\*[^*]+\*)/g);
    return parts.map(part => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return { type: 'italic', value: part.slice(1, -1) };
      }
      return { type: 'text', value: part };
    });
  });

  // 5. Links: [text](url)
  tokens = tokens.flatMap(token => {
    if (token.type !== 'text') return token;
    const parts = token.value.split(/(\[[^\]]+\]\([^)]+\))/g);
    return parts.map(part => {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        return { type: 'link', text: match[1], url: match[2] };
      }
      return { type: 'text', value: part };
    });
  });

  // Map tokens to JSX
  return tokens.map((token, idx) => {
    switch (token.type) {
      case 'code':
        return (
          <code key={idx} className="bg-black/[0.06] dark:bg-white/[0.08] px-1.5 py-0.5 rounded text-sm font-mono text-[#e06c75] dark:text-[#f87171]">
            {token.value}
          </code>
        );
      case 'math':
        return (
          <span key={idx} className="font-mono bg-orange-500/10 dark:bg-orange-400/10 px-1 py-0.5 rounded text-orange-600 dark:text-orange-400">
            {token.value}
          </span>
        );
      case 'bold':
        return <strong key={idx} className="font-bold text-inherit">{token.value}</strong>;
      case 'italic':
        return <em key={idx} className="italic text-inherit">{token.value}</em>;
      case 'link':
        return (
          <a key={idx} href={token.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 dark:text-blue-400 hover:underline">
            {token.text}
          </a>
        );
      default:
        return token.value;
    }
  });
}

const MarkdownRenderer = ({ content }) => {
  if (!content) return null;

  // Split by code blocks first
  const parts = [];
  const regex = /```(\w*)\n([\s\S]*?)(?:```|$)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }
    parts.push({
      type: 'code',
      lang: match[1],
      code: match[2],
    });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }

  // Parse lines into high-level blocks
  const blocks = [];
  parts.forEach((part) => {
    if (part.type === 'code') {
      blocks.push(part);
      return;
    }

    const lines = part.content.split('\n');
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed === '') {
        i++;
        continue;
      }

      // 1. Horizontal Rule
      if (trimmed.match(/^---+$|^\*\*\*+$/)) {
        blocks.push({ type: 'hr' });
        i++;
        continue;
      }

      // 2. Headings
      const h1 = line.match(/^#\s+(.*)$/);
      if (h1) { blocks.push({ type: 'h1', text: h1[1] }); i++; continue; }
      const h2 = line.match(/^##\s+(.*)$/);
      if (h2) { blocks.push({ type: 'h2', text: h2[1] }); i++; continue; }
      const h3 = line.match(/^###\s+(.*)$/);
      if (h3) { blocks.push({ type: 'h3', text: h3[1] }); i++; continue; }
      const h4 = line.match(/^####\s+(.*)$/);
      if (h4) { blocks.push({ type: 'h4', text: h4[1] }); i++; continue; }
      const h5 = line.match(/^#####\s+(.*)$/);
      if (h5) { blocks.push({ type: 'h5', text: h5[1] }); i++; continue; }
      const h6 = line.match(/^######\s+(.*)$/);
      if (h6) { blocks.push({ type: 'h6', text: h6[1] }); i++; continue; }

      // 3. Blockquotes
      if (line.startsWith('>')) {
        let quoteLines = [];
        while (i < lines.length && lines[i].startsWith('>')) {
          let quoteLine = lines[i].slice(1);
          if (quoteLine.startsWith(' ')) quoteLine = quoteLine.slice(1);
          quoteLines.push(quoteLine);
          i++;
        }
        blocks.push({ type: 'quote', content: quoteLines.join('\n') });
        continue;
      }

      // 4. Tables
      if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
        let tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        if (tableLines.length >= 2) {
          const headers = tableLines[0]
            .split('|')
            .map((c) => c.trim())
            .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
          
          const separatorRow = tableLines[1];
          const hasSeparator = separatorRow.includes('-') && separatorRow.includes('|');
          
          let rows = [];
          const startIdx = hasSeparator ? 2 : 1;
          for (let r = startIdx; r < tableLines.length; r++) {
            const cells = tableLines[r]
              .split('|')
              .map((c) => c.trim())
              .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
            rows.push(cells);
          }
          blocks.push({ type: 'table', headers, rows });
          continue;
        } else {
          blocks.push({ type: 'p', text: tableLines[0] });
          continue;
        }
      }

      // 5. Unordered List
      if (line.match(/^([*-])\s+(.*)$/)) {
        let items = [];
        while (i < lines.length && lines[i].match(/^([*-])\s+(.*)$/)) {
          const match = lines[i].match(/^([*-])\s+(.*)$/);
          items.push(match[2]);
          i++;
        }
        blocks.push({ type: 'ul', items });
        continue;
      }

      // 6. Ordered List
      if (line.match(/^\d+\.\s+(.*)$/)) {
        let items = [];
        while (i < lines.length && lines[i].match(/^\d+\.\s+(.*)$/)) {
          const match = lines[i].match(/^\d+\.\s+(.*)$/);
          items.push(match[1]);
          i++;
        }
        blocks.push({ type: 'ol', items });
        continue;
      }

      // 7. Math Block
      if (trimmed.startsWith('$$')) {
        let mathLines = [];
        if (trimmed.endsWith('$$') && trimmed.length > 2) {
          blocks.push({ type: 'math-block', formula: trimmed.slice(2, -2) });
          i++;
          continue;
        } else {
          mathLines.push(trimmed.slice(2));
          i++;
          while (i < lines.length && !lines[i].trim().endsWith('$$')) {
            mathLines.push(lines[i]);
            i++;
          }
          if (i < lines.length) {
            mathLines.push(lines[i].trim().slice(0, -2));
            i++;
          }
          blocks.push({ type: 'math-block', formula: mathLines.join('\n') });
          continue;
        }
      }

      // 8. Normal Paragraph
      let pLines = [];
      while (i < lines.length) {
        const currLine = lines[i];
        const currTrimmed = currLine.trim();
        if (
          currTrimmed === '' ||
          currTrimmed.match(/^---+$|^\*\*\*+$/) ||
          currLine.match(/^#+\s+/) ||
          currLine.startsWith('>') ||
          (currTrimmed.startsWith('|') && currTrimmed.endsWith('|')) ||
          currLine.match(/^([*-])\s+/) ||
          currLine.match(/^\d+\.\s+/) ||
          currTrimmed.startsWith('$$')
        ) {
          break;
        }
        pLines.push(currLine);
        i++;
      }
      blocks.push({ type: 'p', text: pLines.join('\n') });
    }
  });

  // Render the structural blocks into JSX
  return (
    <div className="space-y-4 text-inherit leading-7 break-words">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'code':
            return <CodeBlock key={idx} lang={block.lang} code={block.code} />;
          case 'hr':
            return <hr key={idx} className="my-6 border-t border-gray-200 dark:border-gray-800" />;
          case 'h1':
            return <h1 key={idx} className="text-3xl font-bold my-4 pb-2 border-b border-gray-200 dark:border-gray-800 text-inherit">{parseInline(block.text)}</h1>;
          case 'h2':
            return <h2 key={idx} className="text-2xl font-bold my-3 pb-1 border-b border-gray-200/50 dark:border-gray-800/50 text-inherit">{parseInline(block.text)}</h2>;
          case 'h3':
            return <h3 key={idx} className="text-xl font-bold my-2 text-inherit">{parseInline(block.text)}</h3>;
          case 'h4':
            return <h4 key={idx} className="text-lg font-semibold my-2 text-inherit">{parseInline(block.text)}</h4>;
          case 'h5':
            return <h5 key={idx} className="text-base font-semibold my-2 text-inherit">{parseInline(block.text)}</h5>;
          case 'h6':
            return <h6 key={idx} className="text-sm font-semibold my-2 text-inherit">{parseInline(block.text)}</h6>;
          case 'quote':
            return (
              <blockquote key={idx} className="border-l-4 border-gray-300 dark:border-gray-700 pl-4 py-1.5 my-3 bg-black/[0.02] dark:bg-white/[0.02] rounded-r italic text-gray-600 dark:text-gray-300 text-sm">
                {block.content.split('\n').map((line, lIdx) => (
                  <p key={lIdx}>{parseInline(line)}</p>
                ))}
              </blockquote>
            );
          case 'table':
            return (
              <div key={idx} className="my-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="bg-black/[0.03] dark:bg-white/[0.03] border-b border-gray-200 dark:border-gray-800">
                      {block.headers.map((h, hIdx) => (
                        <th key={hIdx} className="px-4 py-2 text-sm font-bold border-r border-gray-200 dark:border-gray-800 last:border-r-0">
                          {parseInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-gray-200 dark:border-gray-800 last:border-b-0 hover:bg-black/[0.01] dark:hover:bg-white/[0.01]">
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="px-4 py-2 text-sm border-r border-gray-200 dark:border-gray-800 last:border-r-0">
                            {parseInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'ul':
            return (
              <ul key={idx} className="list-disc pl-6 space-y-1 my-2">
                {block.items.map((item, iIdx) => (
                  <li key={iIdx}>{parseInline(item)}</li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className="list-decimal pl-6 space-y-1 my-2">
                {block.items.map((item, iIdx) => (
                  <li key={iIdx}>{parseInline(item)}</li>
                ))}
              </ol>
            );
          case 'math-block':
            return (
              <div key={idx} className="my-4 p-4 bg-orange-500/[0.04] dark:bg-orange-400/[0.04] rounded-lg border border-orange-500/20 dark:border-orange-400/20 overflow-x-auto text-center font-mono text-orange-600 dark:text-orange-400">
                {block.formula}
              </div>
            );
          case 'p':
          default:
            return (
              <p key={idx} className="leading-7">
                {block.text.split('\n').map((line, lIdx) => (
                  <React.Fragment key={lIdx}>
                    {lIdx > 0 && <br />}
                    {parseInline(line)}
                  </React.Fragment>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
};

export default React.memo(MarkdownRenderer);
