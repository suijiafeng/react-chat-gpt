import React, { useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../hooks';

// mermaid 体积很大（~1MB+），首次遇到 mermaid 代码块时才懒加载
let mermaidPromise = null;
const loadMermaid = () => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => m.default);
  }
  return mermaidPromise;
};

let renderSeq = 0;

/**
 * mermaid 代码块渲染：
 * - 流式生成中只展示源码（半截代码解析必然报错，且频繁重渲染浪费）；
 * - 生成完成后渲染为图表，可切换查看源码；
 * - 解析失败时回退到源码展示并附错误提示。
 */
const MermaidBlock = React.memo(({ code, isTyping }) => {
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [showSource, setShowSource] = useState(false);

  useEffect(() => {
    if (isTyping || !code.trim()) return;
    let cancelled = false;
    setError('');
    loadMermaid()
      .then(async (mermaid) => {
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'strict',
        });
        const { svg: rendered } = await mermaid.render(`mermaid-svg-${renderSeq++}`, code);
        if (!cancelled) setSvg(rendered);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'mermaid 解析失败');
      });
    return () => {
      cancelled = true;
    };
  }, [code, isTyping, isDark]);

  const sourceView = (
    <pre className="overflow-x-auto p-4 text-sm leading-6 !bg-transparent !m-0 font-mono whitespace-pre">
      {code}
    </pre>
  );

  return (
    <div
      className={`my-4 overflow-hidden rounded-lg border ${
        isDark ? 'border-gray-800 bg-[#1b1b1b] text-[#d4d4d4]' : 'border-gray-200 bg-white text-gray-800'
      }`}
    >
      <div
        className={`flex items-center justify-between px-3 py-1.5 text-[12px] select-none ${
          isDark ? 'bg-[#2d2d2d] text-gray-400' : 'bg-gray-50 text-gray-500'
        }`}
      >
        <span className="font-mono font-medium tracking-normal">mermaid</span>
        {!isTyping && !error && svg && (
          <button
            onClick={() => setShowSource((v) => !v)}
            className={`transition-colors duration-150 ease-out ${isDark ? 'hover:text-white' : 'hover:text-black'}`}
          >
            {showSource ? t('mermaidChart') : t('mermaidSource')}
          </button>
        )}
      </div>
      {isTyping || !svg || error || showSource ? (
        <>
          {sourceView}
          {error && !isTyping && (
            <div className={`px-4 pb-3 text-[13px] ${isDark ? 'text-red-300' : 'text-red-600'}`}>
              图表渲染失败：{error}
            </div>
          )}
        </>
      ) : (
        <div
          className="overflow-x-auto p-4 flex justify-center [&_svg]:max-w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      )}
    </div>
  );
});

MermaidBlock.displayName = 'MermaidBlock';

export default MermaidBlock;
