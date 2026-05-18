// 会话导出：把当前会话的全部消息导出为 Markdown 文件下载。

import { initDB } from '../store/db';

// 读取会话的全部消息（导出用，不分页）
const loadAllMessages = async (sessionId) => {
  const db = await initDB();
  const tx = db.transaction('chatMessages', 'readonly');
  const index = tx.store.index('sessionId_timestamp');
  const range = IDBKeyRange.bound([sessionId, ''], [sessionId, '￿']);
  return index.getAll(range);
};

const getSessionTitle = async (sessionId) => {
  const db = await initDB();
  const session = await db.get('chatSessions', sessionId);
  return session?.title || '对话记录';
};

const sanitizeFilename = (name) => name.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || 'chat';

/** 导出指定会话为 Markdown 文件（浏览器下载） */
export const exportSessionAsMarkdown = async (sessionId) => {
  const [title, messages] = await Promise.all([
    getSessionTitle(sessionId),
    loadAllMessages(sessionId),
  ]);

  const lines = [`# ${title}`, '', `> 导出时间：${new Date().toLocaleString()}`, ''];
  for (const msg of messages) {
    lines.push(`## ${msg.isUser ? '用户' : '助手'}`);
    if (msg.attachments?.length) {
      msg.attachments.forEach((a) => lines.push(`> 附件：${a.name}`));
    }
    if (msg.images?.length) {
      lines.push(`> 附带 ${msg.images.length} 张图片`);
    }
    lines.push('', msg.text || '*（空消息）*', '');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(title)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};
