import { createLowlight } from 'lowlight';
import { visit } from 'unist-util-visit';
import { toText } from 'hast-util-to-text';

// 按需注册语言，避免打包 highlight.js 的全量语言包。
// rehype-highlight 内部静态引入了 lowlight 的 common 全集（37 种语言），
// 无法被 tree-shaking 移除，所以这里改为自建轻量插件、只注册常用语言。
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import bash from 'highlight.js/lib/languages/bash';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import java from 'highlight.js/lib/languages/java';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';

const lowlight = createLowlight({
  javascript,
  typescript,
  python,
  json,
  bash,
  xml,
  css,
  java,
  c,
  cpp,
  go,
  rust,
  sql,
  yaml,
  markdown,
});

// 常见别名，让 ```js、```py 这类简写也能命中
lowlight.registerAlias({
  javascript: ['js', 'jsx', 'mjs', 'cjs', 'node'],
  typescript: ['ts', 'tsx'],
  python: ['py', 'python3'],
  bash: ['sh', 'shell', 'zsh', 'console'],
  xml: ['html', 'svg', 'vue'],
  yaml: ['yml'],
  markdown: ['md'],
  cpp: ['c++', 'cc'],
});

/**
 * 轻量版语法高亮 rehype 插件。
 * 只处理 <pre><code class="language-xx"> 形式的代码块；
 * 未注册的语言原样保留纯文本，不报错。
 */
export default function rehypeHighlightLite() {
  return (tree) => {
    visit(tree, 'element', (node, _index, parent) => {
      if (node.tagName !== 'code' || parent?.tagName !== 'pre') return;

      const classes = (node.properties?.className || []).map(String);
      const lang = classes.find((c) => c.startsWith('language-'))?.slice('language-'.length);
      if (!lang || !lowlight.registered(lang)) return;

      const result = lowlight.highlight(lang, toText(parent));
      node.children = result.children;
      node.properties.className = [...classes, 'hljs'];
    });
  };
}
