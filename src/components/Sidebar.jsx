import { useEffect, useState, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { message as antdMessage, Modal } from 'antd';
import {
  MessageSquare,
  X,
  LogOut,
  PenSquare,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Trash2,
  Download,
  Search,
  Pencil,
  Pin,
  PinOff,
  UserRound,
} from 'lucide-react';
import ProfileModal from './ProfileModal';
import SettingsModal from './SettingsModal';
import AppLogo from './AppLogo';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
import { userStore } from '../store';
import { getAllSessions, deleteSession, updateSessionTitle, setSessionPinned } from '../store/db';
import { userSignOut } from '../apis/auths';
import { reloadForCurrentUser } from '../store/llmConfig';
import { APP_NAME } from '../constants';
import { shouldSubmitOnEnter } from '../utils/ime';

const RECENT_CHATS_COLLAPSED_KEY = 'recent_chats_collapsed';

const Sidebar = observer(({ isOpen, onClose, refreshKey }) => {
  const { classes, isDark } = useTheme();
  const { t } = useLanguage();
  // 个人设置弹窗（昵称/数据管理）
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { userProfile } = userStore;
  // null = 尚未从 IndexedDB 加载完成。加载完成前不渲染"暂无聊天记录"，
  // 避免刷新时占位文字先闪现、列表随后才顶上来的抖动
  const [sessions, setSessions] = useState(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isRecentChatsCollapsed, setIsRecentChatsCollapsed] = useState(
    () => localStorage.getItem(RECENT_CHATS_COLLAPSED_KEY) === 'true'
  );
  // 当前展开"更多操作"菜单的会话 id（同一时间只能有一个展开）
  const [openMenuSessionId, setOpenMenuSessionId] = useState(null);
  // 会话搜索关键词（客户端过滤已加载的列表）
  const [searchKeyword, setSearchKeyword] = useState('');
  // 正在重命名的会话 id 及草稿
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const userMenuRef = useRef(null);
  const sessionMenuRef = useRef(null);
  const searchInputRef = useRef(null);

  const loadSessions = useCallback(async () => {
    const all = await getAllSessions();
    setSessions(all);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions, refreshKey]);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handlePointerDown = (event) => {
      if (!userMenuRef.current?.contains(event.target)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (!openMenuSessionId) return;

    const handlePointerDown = (event) => {
      if (!sessionMenuRef.current?.contains(event.target)) {
        setOpenMenuSessionId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [openMenuSessionId]);

  // Cmd/Ctrl+K 聚焦搜索框（同类产品的通用习惯）
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startRename = useCallback((session) => {
    setOpenMenuSessionId(null);
    setRenamingId(session.id);
    setRenameDraft(session.title || t('newChatTitle'));
  }, [t]);

  const commitRename = useCallback(async () => {
    const id = renamingId;
    const title = renameDraft.trim();
    setRenamingId(null);
    if (!id || !title) return;
    await updateSessionTitle(id, title);
    await loadSessions();
  }, [renamingId, renameDraft, loadSessions]);

  const handleTogglePinned = useCallback(
    async (session) => {
      setOpenMenuSessionId(null);
      await setSessionPinned(session.id, !session.pinned);
      await loadSessions();
    },
    [loadSessions]
  );

  const handleNewChat = useCallback(() => {
    navigate('/new');
    if (window.innerWidth < 1024) onClose();
  }, [navigate, onClose]);

  const handleSelectSession = useCallback(
    (id) => {
      navigate(`/c/${id}`);
      if (window.innerWidth < 1024) onClose();
    },
    [navigate, onClose]
  );

  const handleDeleteSession = useCallback(
    async (id) => {
      setOpenMenuSessionId(null);
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      // 如果删除的是当前会话，跳到新对话
      if (chatId === id) navigate('/new');
    },
    [chatId, navigate]
  );

  const handleDownloadSession = useCallback(async (id) => {
    setOpenMenuSessionId(null);
    try {
      const { exportSessionAsMarkdown } = await import('../utils/exportMarkdown');
      await exportSessionAsMarkdown(id);
    } catch (error) {
      antdMessage.error(t('exportFailed', { msg: error.message }));
    }
  }, [t]);

  const handleSignOut = useCallback(() => {
    setIsUserMenuOpen(false);
    // 免登录体验退出会销毁全部体验数据，确认文案必须把后果说清楚；
    // 正常账号退出也需确认，防止误触（菜单项紧挨着其他入口）
    const isGuestSession = localStorage.getItem('demo_mode') === 'true';
    Modal.confirm({
      title: t('signOutConfirmTitle'),
      content: isGuestSession ? t('signOutConfirmDemoHint') : undefined,
      okText: t('signOut'),
      cancelText: t('cancel'),
      okButtonProps: isGuestSession ? { danger: true } : undefined,
      onOk: async () => {
        // 内部会清理 demo_mode 标记；免登录体验退出时还会销毁该体验身份的全部数据
        await userSignOut();
        userStore.clearUser();
        reloadForCurrentUser(); // 清掉该账号的配置内存缓存（明文 key 不留在内存里）
        navigate('/login', { replace: true });
      },
    });
  }, [navigate, t]);

  const toggleRecentChats = useCallback(() => {
    setIsRecentChatsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(RECENT_CHATS_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  return (
    <div
      className={`fixed lg:relative top-0 left-0 flex flex-col h-full border-r ${classes.panel
        } ${classes.text} ${classes.border} ${classes.themeTransition} transition-[width,background-color,border-color,color] duration-150 ease-out ${isOpen ? 'w-[280px]' : 'w-0'
        } overflow-hidden z-50`}
    >
      <div className="w-[280px] flex-1 flex flex-col min-h-0">
        <div className={`h-16 px-5 flex justify-between items-center flex-shrink-0 border-b ${classes.hairline}`}>
          <AppLogo name={APP_NAME} />
          <button
            onClick={onClose}
            className={`${classes.iconBtn} ${classes.focusRing} ${classes.buttonText} ${classes.buttonHover} lg:hidden`}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="px-3 pt-4 flex-shrink-0 space-y-1">
          <button
            type="button"
            onClick={handleNewChat}
            className={`flex min-h-10 w-full items-center gap-2.5 rounded-md px-2 text-sm ${classes.focusRing} ${classes.themeTransition} ${classes.buttonHover}`}
          >
            <PenSquare size={16} strokeWidth={1.75} className="shrink-0" />
            <span>{t('newChat')}</span>
          </button>
          {/* 会话搜索：客户端按标题过滤，Cmd/Ctrl+K 快速聚焦 */}
          <div className="relative">
            <Search
              size={16}
              strokeWidth={1.75}
              className={`absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none ${classes.mutedText}`}
            />
            <input
              ref={searchInputRef}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              type="text"
              placeholder={`${t('searchChats')} (⌘K)`}
              className={`h-10 w-full rounded-md border pl-8 pr-2.5 text-sm outline-none ${classes.focusRing} ${classes.input} ${classes.themeTransition}`}
            />
          </div>
        </div>
        <div className={`mx-3 mt-3 border-t ${classes.border}`}></div>
        <button
          onClick={toggleRecentChats}
          className={`mx-3 flex w-[calc(100%-1.5rem)] items-center justify-between gap-2 rounded-md px-2 pt-4 pb-1 text-[13px] font-medium tracking-normal ${classes.mutedText} ${classes.themeTransition} ${classes.buttonHover}`}
        >
          <span>{t('recentChats')}</span>
          <ChevronDown
            size={14}
            strokeWidth={1.75}
            className={`shrink-0 transition-transform duration-150 ease-out ${
              isRecentChatsCollapsed ? 'rotate-180' : ''
            }`}
          />
        </button>

        <div className={`min-h-0 flex-1 overflow-hidden px-3 transition-[padding] duration-150 ease-out ${
          isRecentChatsCollapsed ? 'pb-0' : 'overflow-y-auto pt-1 pb-4'
        }`}>
          {!isRecentChatsCollapsed && (
            <>
              {sessions === null ? null : sessions.length === 0 ? (
                <div className={`px-2 py-6 text-sm ${classes.mutedText}`}>{t('noChats')}</div>
              ) : (
                <div className="space-y-1">
                  {(() => {
                    const keyword = searchKeyword.trim().toLowerCase();
                    const visibleSessions = keyword
                      ? sessions.filter((s) => (s.title || t('newChatTitle')).toLowerCase().includes(keyword))
                      : sessions;
                    if (keyword && visibleSessions.length === 0) {
                      return (
                        <div className={`px-2 py-6 text-sm ${classes.mutedText}`}>
                          <p>{t('noSearchResults')}</p>
                          <button
                            type="button"
                            onClick={() => setSearchKeyword('')}
                            className={`mt-2 text-sm underline underline-offset-4 ${classes.text}`}
                          >
                            {t('clearSearch')}
                          </button>
                        </div>
                      );
                    }
                    return visibleSessions.map((session) => (
                    <div
                      key={session.id}
                      className={`group relative flex items-center justify-between w-full rounded-md text-sm ${classes.themeTransition} ${chatId === session.id
                        ? isDark
                          ? 'bg-white/[0.08] text-white'
                          : 'bg-black/[0.05] text-black'
                        : `${classes.text} ${classes.buttonHover}`
                        }`}
                    >
                      {renamingId === session.id ? (
                        <div className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2">
                          <MessageSquare size={16} strokeWidth={1.75} className="shrink-0 opacity-70" />
                          <input
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(e) => {
                              if (shouldSubmitOnEnter(e)) commitRename();
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            className={`w-full min-w-0 rounded-md border px-2 py-1 text-sm outline-none ${classes.input} ${classes.themeTransition}`}
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSelectSession(session.id)}
                          className={`flex min-h-10 min-w-0 flex-1 items-center gap-2.5 px-2 text-left ${classes.focusRing}`}
                        >
                          {session.pinned ? (
                            <Pin size={16} strokeWidth={1.75} className="shrink-0 opacity-70" />
                          ) : (
                            <MessageSquare size={16} strokeWidth={1.75} className="shrink-0 opacity-70" />
                          )}
                          <span className="truncate">{session.title || t('newChatTitle')}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setOpenMenuSessionId((prev) => (prev === session.id ? null : session.id))
                        }
                        aria-label={t('moreActions')}
                        title={t('moreActions')}
                        className={`mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md opacity-70 transition-opacity duration-150 ease-out hover:opacity-100 focus-visible:opacity-100 max-sm:opacity-100 group-hover:opacity-100 ${classes.focusRing} ${
                          openMenuSessionId === session.id ? 'opacity-100' : ''
                        } ${isDark ? 'text-[#a1a1aa] hover:bg-white/10 hover:text-white' : 'text-[#6b7280] hover:bg-black/5 hover:text-gray-900'
                          }`}
                      >
                        <MoreHorizontal size={16} strokeWidth={1.75} />
                      </button>
                      {openMenuSessionId === session.id && (
                        <div
                          ref={sessionMenuRef}
                          className={`absolute right-2 top-full mt-1 z-10 w-36 rounded-lg p-1 ${classes.menu}`}
                        >
                          <button
                            type="button"
                            onClick={() => startRename(session)}
                            className={`flex w-full items-center gap-2.5 rounded-md min-h-10 px-2.5 text-sm ${classes.themeTransition} ${
                              isDark
                                ? 'text-white/70 hover:bg-white/10 hover:text-white'
                                : 'text-gray-600 hover:bg-black/5 hover:text-gray-900'
                            }`}
                          >
                            <Pencil size={16} strokeWidth={1.75} />
                            <span>{t('rename')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleTogglePinned(session)}
                            className={`flex w-full items-center gap-2.5 rounded-md min-h-10 px-2.5 text-sm ${classes.themeTransition} ${
                              isDark
                                ? 'text-white/70 hover:bg-white/10 hover:text-white'
                                : 'text-gray-600 hover:bg-black/5 hover:text-gray-900'
                            }`}
                          >
                            {session.pinned ? <PinOff size={16} strokeWidth={1.75} /> : <Pin size={16} strokeWidth={1.75} />}
                            <span>{session.pinned ? t('unpin') : t('pin')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadSession(session.id)}
                            className={`flex w-full items-center gap-2.5 rounded-md min-h-10 px-2.5 text-sm ${classes.themeTransition} ${
                              isDark
                                ? 'text-white/70 hover:bg-white/10 hover:text-white'
                                : 'text-gray-600 hover:bg-black/5 hover:text-gray-900'
                            }`}
                          >
                            <Download size={16} strokeWidth={1.75} />
                            <span>{t('download')}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSession(session.id)}
                            className={`flex w-full items-center gap-2.5 rounded-md min-h-10 px-2.5 text-sm ${classes.themeTransition} ${
                              isDark
                                ? 'text-white/70 hover:bg-white/10 hover:text-red-300'
                                : 'text-gray-600 hover:bg-black/5 hover:text-red-500'
                            }`}
                          >
                            <Trash2 size={16} strokeWidth={1.75} />
                            <span>{t('delete')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                    ));
                  })()}
                </div>
              )}
            </>
          )}
        </div>

        {userProfile && (
          <div className="p-2 flex-shrink-0 mt-auto">
            <div ref={userMenuRef} className="relative">
              <div
                className={`pointer-events-none absolute inset-x-0 bottom-full mb-2 transition-opacity duration-150 ease-out ${
                  isUserMenuOpen ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div className={`pointer-events-auto rounded-lg p-1 ${classes.menu}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setIsProfileOpen(true);
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-md min-h-10 px-2.5 text-sm ${classes.themeTransition} ${
                      isDark
                        ? 'text-white/70 hover:bg-white/10 hover:text-white'
                        : 'text-gray-600 hover:bg-black/5 hover:text-gray-900'
                    }`}
                  >
                    <UserRound size={16} strokeWidth={1.75} />
                    <span>{t('profile')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className={`flex w-full items-center gap-2.5 rounded-md min-h-10 px-2.5 text-sm ${classes.themeTransition} ${
                      isDark
                        ? 'text-white/70 hover:bg-white/10 hover:text-red-300'
                        : 'text-gray-600 hover:bg-black/5 hover:text-red-500'
                    }`}
                  >
                    <LogOut size={16} strokeWidth={1.75} />
                    <span>{t('signOut')}</span>
                  </button>
                </div>
              </div>
              <div
                className={`rounded-md px-2 py-2 ${
                  isDark ? 'bg-white/[0.04]' : 'bg-black/[0.02]'
                }`}
              >
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className={`flex w-full items-center justify-between gap-2 rounded-md text-left ${classes.themeTransition} ${classes.buttonHover}`}
              >
                <div className="flex items-center min-w-0">
                  {userProfile?.profile_image_url ? (
                    <img
                      src={userProfile.profile_image_url}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                        const fallback = event.currentTarget.nextElementSibling;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                      className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                    />
                  ) : null}
                  <div
                    className={`h-8 w-8 items-center justify-center rounded-full flex-shrink-0 bg-[#c2410c] text-sm font-semibold text-white ${
                      userProfile?.profile_image_url ? 'hidden' : 'flex'
                    }`}
                  >
                    {(userProfile.name || userProfile.email || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="ml-2.5 min-w-0">
                    <div className="truncate text-sm font-medium">
                      {userProfile.name || userProfile.email?.split('@')[0] || '用户'}
                    </div>
                    <div className={`truncate text-[13px] ${classes.mutedText}`}>{userProfile.email}</div>
                  </div>
                </div>
                <ChevronUp
                  size={16}
                  strokeWidth={1.75}
                  className={`${classes.mutedText} transition-transform duration-150 ease-out ${isUserMenuOpen ? 'rotate-0' : 'rotate-180'}`}
                />
              </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <ProfileModal
        onOpenModelSettings={() => {
          setIsProfileOpen(false);
          setIsSettingsOpen(true);
        }}
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        onChatsCleared={() => {
          loadSessions();
          navigate('/new');
        }}
      />
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
