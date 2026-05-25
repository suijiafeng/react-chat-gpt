import { useEffect, useState } from 'react';
import { Modal } from 'antd';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';

// 每会话系统提示词编辑弹窗：极简形态——一个 textarea + 保存。
// 保存动作（落库 + 通知上层）由调用方通过 onSave 提供。
const SystemPromptModal = ({ isOpen, onClose, value, onSave }) => {
  const { classes, isDark } = useTheme();
  const { t } = useLanguage();
  const [draft, setDraft] = useState(value || '');

  // 每次打开时用最新的已保存值重置草稿，关闭不保存的改动不残留
  useEffect(() => {
    if (isOpen) setDraft(value || '');
  }, [isOpen, value]);

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      onOk={() => {
        onSave(draft.trim());
        onClose();
      }}
      okText={t('save')}
      cancelText={t('cancel')}
      title={t('systemPrompt')}
      destroyOnHidden
      className={isDark ? 'settings-modal settings-modal-dark' : 'settings-modal settings-modal-light'}
      wrapClassName={isDark ? 'settings-modal-wrap settings-modal-wrap-dark' : 'settings-modal-wrap'}
    >
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={6}
        placeholder={t('systemPromptPlaceholder')}
        className={`w-full rounded-xl border px-3 py-2 text-base outline-none resize-y ${classes.input} ${classes.themeTransition}`}
      />
    </Modal>
  );
};

export default SystemPromptModal;
