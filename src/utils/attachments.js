// 附件处理：图片读取/压缩、文本与 PDF 文件的内容提取、
// 以及把「文本 + 图片 + 文件」组装成 OpenAI 兼容的消息 content。
//
// 设计约定：
// - 图片以 base64 dataURL 形式随消息存进 IndexedDB（本地优先，不引入对象存储）；
// - 文件不上传原件，只提取纯文本注入上下文，消息里展示文件卡片；
// - PDF 解析依赖 pdfjs-dist，体积大，按需懒加载。

/** 单张图片的最大边长，超过则用 canvas 等比压缩，控制 base64 体积与 token 消耗 */
const IMAGE_MAX_EDGE = 2000;
/** 单个文件提取文本的字符上限，超出截断（避免撑爆上下文） */
export const FILE_TEXT_LIMIT = 60000;
/** 支持的图片类型 */
export const IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
/** 文件选择器 accept：常见文本/代码/文档格式 + PDF */
export const FILE_ACCEPT =
  '.pdf,.txt,.md,.markdown,.json,.js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.c,.cpp,.h,.cs,.rb,.php,.sh,.yml,.yaml,.toml,.ini,.xml,.html,.css,.sql,.csv,.log';

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });

const readFileAsText = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });

/**
 * 读取图片文件为 dataURL，超大图片等比压缩到 IMAGE_MAX_EDGE 以内。
 * @returns {Promise<{dataUrl: string, name: string}>}
 */
export const readImageFile = async (file) => {
  const rawUrl = await readFileAsDataUrl(file);
  // GIF 压缩会丢动画，原样保留
  if (file.type === 'image/gif') return { dataUrl: rawUrl, name: file.name };

  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('图片解码失败'));
    el.src = rawUrl;
  });

  const maxEdge = Math.max(img.width, img.height);
  if (maxEdge <= IMAGE_MAX_EDGE) return { dataUrl: rawUrl, name: file.name };

  const scale = IMAGE_MAX_EDGE / maxEdge;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  // 统一转 jpeg 以获得更小体积（png 截图压缩率差）
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), name: file.name };
};

/** 懒加载 pdfjs 并提取 PDF 全文文本 */
const extractPdfText = async (file) => {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const parts = [];
  let total = 0;
  for (let i = 1; i <= doc.numPages && total < FILE_TEXT_LIMIT; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((item) => item.str).join(' ');
    parts.push(text);
    total += text.length;
  }
  return parts.join('\n\n');
};

/**
 * 读取一个非图片文件，提取文本内容。
 * @returns {Promise<{name: string, size: number, kind: 'pdf'|'text', textContent: string, truncated: boolean}>}
 */
export const readAttachmentFile = async (file) => {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const raw = isPdf ? await extractPdfText(file) : await readFileAsText(file);
  const truncated = raw.length > FILE_TEXT_LIMIT;
  return {
    name: file.name,
    size: file.size,
    kind: isPdf ? 'pdf' : 'text',
    textContent: truncated ? raw.slice(0, FILE_TEXT_LIMIT) : raw,
    truncated,
  };
};

/** 把附件文本包装进用户消息文本，模型能明确区分「文件内容」与「用户问题」 */
export const composeTextWithAttachments = (text, attachments) => {
  if (!attachments?.length) return text;
  const fileBlocks = attachments
    .map(
      (a) =>
        `[附件文件: ${a.name}${a.truncated ? '（内容过长已截断）' : ''}]\n"""\n${a.textContent}\n"""`
    )
    .join('\n\n');
  return `${fileBlocks}\n\n${text}`;
};

/**
 * 组装 OpenAI 兼容的消息 content：
 * - 无图片 → 纯字符串（兼容性最好）
 * - 有图片 → [{type:'text'}, {type:'image_url'}...] 数组（vision 格式）
 */
export const buildUserContent = (text, images, attachments) => {
  const fullText = composeTextWithAttachments(text, attachments);
  if (!images?.length) return fullText;
  return [
    { type: 'text', text: fullText },
    ...images.map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } })),
  ];
};

/**
 * 从消息 content（字符串或 vision 数组）中提取纯文本。
 * 供不支持多模态数组格式的消费方使用（demo 关键词匹配、Ollama 原生协议等）。
 */
export const contentToText = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === 'text')
      .map((part) => part.text)
      .join('\n');
  }
  return '';
};

/** 前端校验：文件类型是否受支持（图片按 MIME，其余按扩展名白名单） */
export const isSupportedFile = (file) => {
  if (file.type.startsWith('image/')) {
    return IMAGE_ACCEPT.split(',').includes(file.type);
  }
  const name = file.name.toLowerCase();
  return FILE_ACCEPT.split(',').some((ext) => name.endsWith(ext));
};

/** 文件大小人类可读格式 */
export const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
