import { useEffect, useState } from 'react';
import { Modal, Popconfirm, message as antdMessage } from 'antd';
import { Download, Trash2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
import { userStore } from '../store';
import { updateProfileName } from '../apis/auths';
import { clearAllSessions } from '../store/db';

// 个人设置弹窗：昵称修改 + 数据管理（导出全部 / 清空全部）。
// 账号邮箱只读展示；改名按登录形态分别持久化（见 apis/auths.js updateProfileName）。
const ProfileModal = ({ isOpen, onClose, onChatsCleared }) => {
  const { classes, isDark } = useTheme();
  const { t } = useLanguage();
  const profile = userStore.userProfile;
  const [nameDraft, setNameDraft] = useState(profile?.name || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setNameDraft(userStore.userProfile?.name || '');
  }, [isOpen]);

  const handleSave = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      antdMessage.warning(t('nicknameRequired'));
      return;
    }
    setSaving(true);
    try {
      await updateProfileName(trimmed);
      userStore.setUser({ ...userStore.userProfile, name: trimmed });
      antdMessage.success(t('profileSaved'));
      onClose();
    } catch (error) {
      antdMessage.error(error.message || t('somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  };

  const handleExportAll = async () => {
    try {
      const { exportAllSessionsAsMarkdown } = await import('../utils/exportMarkdown');
      const count = await exportAllSessionsAsMarkdown();
      if (!count) antdMessage.info(t('noExportData'));
    } catch (error) {
      antdMessage.error(t('exportFailed', { msg: error.message }));
    }
  };

  const handleClearAll = async () => {
    await clearAllSessions();
    antdMessage.success(t('cleared'));
    onClose();
    onChatsCleared?.();
  };

  const dataActionRowClass = `flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-base ${classes.border} ${
    isDark ? 'text-white/80 hover:bg-white/5' : 'text-gray-700 hover:bg-black/[0.03]'
  }`;

  return (
    <Modal
      open={isOpen}
      onCancel={onClose}
      onOk={handleSave}
      okText={t('save')}
      cancelText={t('cancel')}
      confirmLoading={saving}
      title={t('profile')}
      destroyOnHidden
      className={isDark ? 'settings-modal settings-modal-dark' : 'settings-modal settings-modal-light'}
      wrapClassName={isDark ? 'settings-modal-wrap settings-modal-wrap-dark' : 'settings-modal-wrap'}
    >
      <div className="flex flex-col gap-5 py-1">
        {/* 账号信息 */}
        <div>
          <div className={`mb-2 text-sm font-medium ${classes.mutedText}`}>{t('Email')}</div>
          <div className={`rounded-xl border px-3 py-2.5 text-base opacity-70 select-all ${classes.border}`}>
            {profile?.email}
          </div>
        </div>

        {/* 昵称 */}
        <div>
          <div className={`mb-2 text-sm font-medium ${classes.mutedText}`}>{t('nickname')}</div>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder={t('Enter Your Full Name')}
            className={`w-full rounded-xl border px-3 py-2.5 text-base outline-none ${classes.input} ${classes.themeTransition}`}
          />
        </div>

        {/* 数据管理 */}
        <div>
          <div className={`mb-2 text-sm font-medium ${classes.mutedText}`}>{t('dataManagement')}</div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={handleExportAll} className={dataActionRowClass}>
              <Download size={16} />
              <span>{t('exportAll')}</span>
            </button>
            <Popconfirm
              title={t('clearAllConfirm')}
              okText={t('delete')}
              cancelText={t('cancel')}
              okButtonProps={{ danger: true }}
              onConfirm={handleClearAll}
            >
              <button
                type="button"
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-base ${classes.border} ${
                  isDark ? 'text-red-300 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'
                }`}
              >
                <Trash2 size={16} />
                <span>{t('clearAll')}</span>
              </button>
            </Popconfirm>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ProfileModal;
