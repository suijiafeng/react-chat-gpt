// 会话导出：把当前会话的全部消息导出为 Markdown 文件下载。

import { initDB, getAllSessions } from '../store/db';
import { decryptString, decryptJson } from './keyVault';

// 读取会话的全部消息（导出用，不分页）。
// 落盘的正文是密文（见 store/db.js 的加密说明），导出前要还原；
// 加密上线前的明文存量原样返回。
const loadAllMessages = async (sessionId) => {
  const db = await initDB();
  const tx = db.transaction('chatMessages', 'readonly');
  const index = tx.store.index('sessionId_timestamp');
  const range = IDBKeyRange.bound([sessionId, ''], [sessionId, '￿']);
  const records = await index.getAll(range);
  return Promise.all(
    records.map(async (record) => {
      if (!record?.enc) return record;
      const { enc, ...meta } = record;
      return { ...meta, ...((await decryptJson(enc)) || { text: '（无法解密）' }) };
    })
  );
};

const getSessionTitle = async (sessionId) => {
  const db = await initDB();
  const session = await db.get('chatSessions', sessionId);
  if (!session) return '对话记录';
  const title = session.titleEnc ? await decryptString(session.titleEnc) : session.title;
  return title || '对话记录';
};

const sanitizeFilename = (name) => name.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60) || 'chat';

/** 导出全部会话为单个 Markdown 文件（个人设置里的数据管理功能） */
export const exportAllSessionsAsMarkdown = async () => {
  // 经 getAllSessions 拿列表：天然只包含当前用户的会话（数据隔离），且标题已解密
  const sessions = await getAllSessions();
  if (!sessions.length) return 0;

  const lines = [`# 全部对话导出`, '', `> 导出时间：${new Date().toLocaleString()}`, ''];
  for (const session of sessions) {
    const messages = await loadAllMessages(session.id);
    lines.push(`# ${session.title || '对话记录'}`, '');
    for (const msg of messages) {
      lines.push(`## ${msg.isUser ? '用户' : '助手'}`);
      if (msg.attachments?.length) msg.attachments.forEach((a) => lines.push(`> 附件：${a.name}`));
      if (msg.images?.length) lines.push(`> 附带 ${msg.images.length} 张图片`);
      lines.push('', msg.text || '*（空消息）*', '');
    }
    lines.push('---', '');
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'all_chats.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return sessions.length;
};

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
