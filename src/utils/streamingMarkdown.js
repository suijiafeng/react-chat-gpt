// 流式 Markdown 的"稳定前缀"切分。
//
// 问题：流式生成时每次刷新都要把已累积的全文重新交给 react-markdown 解析，
// 单次成本随内容长度线性增长，整条消息的总解析成本是平方级——
// 几千字后每秒 20 次的全文重解析会明显拖慢主线程。
//
// 方案：把内容切成「稳定前缀 + 活跃尾部」两段分别渲染。
// 前缀只在新块完成时才变化（引用稳定 → React.memo 直接跳过重解析），
// 每次刷新真正重新解析的只有很短的尾部。
//
// 切分必须发生在"安全"的块边界（空行），且不能落在未闭合的
// 代码块（``` / ~~~）或块级公式（$$）内部——否则前后两段各自解析会错乱。

const FENCE_RE = /^(\s{0,3})(`{3,}|~{3,})/;
const MATH_FENCE_RE = /^\s*\$\$/;

/** 尾部至少保留的字符数：留出余量避免表格等跨行结构被切在半截 */
const MIN_TAIL = 64;

/**
 * @param {string} content 流式累积的 Markdown 全文
 * @returns {{stable: string, tail: string}} stable 可能为空串（尚无完整块）
 */
export const splitStableMarkdown = (content) => {
  if (!content) return { stable: '', tail: '' };

  const lines = content.split('\n');
  let inCodeFence = false;
  let fenceMarker = ''; // 记录开栏用的字符（` 或 ~），闭栏必须同种
  let inMathBlock = false;

  let offset = 0; // 当前行行首在全文中的偏移
  let lastSafeBoundary = 0; // 最近一个可以切分的偏移（空行之后）

  for (const line of lines) {
    if (inCodeFence) {
      const m = line.match(FENCE_RE);
      if (m && m[2][0] === fenceMarker && m[2].length >= 3) inCodeFence = false;
    } else if (inMathBlock) {
      if (MATH_FENCE_RE.test(line)) inMathBlock = false;
    } else {
      const fence = line.match(FENCE_RE);
      if (fence) {
        inCodeFence = true;
        fenceMarker = fence[2][0];
      } else if (MATH_FENCE_RE.test(line) && !/\$\$.*\$\$/.test(line.replace(/^\s*\$\$/, ''))) {
        // 单行 $$...$$ 不算开栏；行内只有开栏 $$ 才进入公式块
        if (!/^\s*\$\$.*\$\$\s*$/.test(line)) inMathBlock = true;
      } else if (line.trim() === '') {
        // 空行且不在任何栅栏内 → 此行结束处是安全切分点。
        // 只记录距末尾至少 MIN_TAIL 的边界：太靠近末尾的忽略、
        // 自动回退到更早的边界（而不是放弃切分）
        const boundary = offset + line.length + 1;
        if (content.length - boundary >= MIN_TAIL) {
          lastSafeBoundary = boundary;
        }
      }
    }
    offset += line.length + 1; // +1 换行符
  }

  if (lastSafeBoundary === 0) {
    return { stable: '', tail: content };
  }

  return {
    stable: content.slice(0, lastSafeBoundary),
    tail: content.slice(lastSafeBoundary),
  };
};
