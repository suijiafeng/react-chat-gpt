import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import {
  MessageSquare,
  X,
  LogOut,
  PenSquare,
  ChevronUp,
} from 'lucide-react';
import AppLogo from './AppLogo';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
import { userStore } from '../store';
import { getAllSessions, deleteSession } from '../store/db';
import { userSignOut } from '../apis/auths';
import { logoutDemo } from '../hooks';
import { APP_NAME } from '../constants';

const Sidebar = observer(({ isOpen, onClose, refreshKey }) => {
  const { classes, isDark } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { chatId } = useParams();
  const { userProfile } = userStore;
  const [sessions, setSessions] = useState([]);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

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

  const quickLinks = useMemo(
    () => [
      { icon: PenSquare, label: t('newChat') },
      // { icon: Search, label: '搜索聊天' },
      // { icon: ImageIcon, label: '图片' },
      // { icon: FolderOpen, label: '库' },
      // { icon: Blocks, label: '应用' },
      // { icon: Compass, label: '深度研究' },
    ],
    [t]
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
    async (e, id) => {
      e.stopPropagation();
      await deleteSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      // 如果删除的是当前会话，跳到新对话
      if (chatId === id) navigate('/new');
    },
    [chatId, navigate]
  );

  const handleSignOut = useCallback(() => {
    setIsUserMenuOpen(false);
    userSignOut();
    logoutDemo();
    userStore.clearUser();
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div
      className={`fixed lg:relative top-0 left-0 flex flex-col h-full border-r ${classes.panel
        } ${classes.text} ${classes.border} ${classes.themeTransition} transition-[width,background-color,border-color,color,box-shadow] duration-200 ease-out ${isOpen ? 'w-[308px]' : 'w-0'
        } overflow-hidden z-50`}
    >
      <div className="w-[308px] flex-1 flex flex-col min-h-0">
        <div className="px-5 pt-4 pb-3 flex justify-between items-center flex-shrink-0">
          <AppLogo name={APP_NAME} />
          <button
            onClick={onClose}
            className={`${classes.buttonText} ${classes.buttonHover} rounded-lg p-2 lg:hidden`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pt-4 flex-shrink-0 space-y-1">
          {quickLinks.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              onClick={handleNewChat}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${classes.themeTransition} ${classes.buttonHover}`}
            >
              <Icon size={18} className="shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className={`border-b h-[8px] ${isDark ? 'border-white/10' : 'border-black/10'}`}></div>
        <div className={`px-5 pt-5 pb-2 text-xs font-medium uppercase tracking-[0.2em] ${isDark
          ? 'text-white/35'
          : 'text-black/35'}`}>
          {t('recentChats')}
        </div>

        <div className="px-3 pb-4 overflow-y-auto flex-1 min-h-0">
          {sessions.length === 0 ? (
            <div className={`px-3 py-6 text-sm ${classes.mutedText}`}>暂无聊天记录</div>
          ) : (
            <div className="space-y-1">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center justify-between w-full rounded-xl text-sm ${classes.themeTransition} ${chatId === session.id
                    ? isDark
                      ? 'bg-white/[0.08] text-white'
                      : 'bg-black/[0.05] text-black'
                    : `${classes.text} ${classes.buttonHover}`
                    }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectSession(session.id)}
                    className="flex flex-1 min-w-0 items-center gap-3 px-3 py-2.5 text-left"
                  >
                    <MessageSquare size={16} className="shrink-0 opacity-70" />
                    <span className="truncate">{session.title || '新对话'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    aria-label="删除该对话"
                    title="删除"
                    className={`mr-2 shrink-0 rounded-md p-1 opacity-60 transition-opacity duration-200 ease-out hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 ${isDark ? 'text-white/45 hover:bg-white/10 hover:text-red-300' : 'text-gray-400 hover:bg-black/5 hover:text-red-500'
                      }`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {userProfile && (
          <div className="p-2 flex-shrink-0 mt-auto">
            <div ref={userMenuRef} className="relative">
              <div
                className={`pointer-events-none absolute inset-x-0 bottom-full mb-2 origin-bottom ${
                  classes.themeTransition
                } ${
                  isUserMenuOpen
                    ? 'translate-y-0 opacity-100'
                    : 'translate-y-2 opacity-0'
                }`}
              >
                <div
                  className={`pointer-events-auto rounded-xl border p-1 shadow-lg ${
                    classes.border
                  } ${isDark ? 'bg-[#222222]' : 'bg-white'}`}
                >
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${classes.themeTransition} ${
                      isDark
                        ? 'text-white/70 hover:bg-white/10 hover:text-red-300'
                        : 'text-gray-600 hover:bg-black/5 hover:text-red-500'
                    }`}
                  >
                    <LogOut size={18} />
                    <span>退出登录</span>
                  </button>
                </div>
              </div>
              <div
                className={`border rounded-md px-3 py-3 ${classes.border} ${
                  isDark ? 'bg-white/[0.04]' : 'bg-black/[0.02]'
                }`}
              >
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className={`flex w-full items-center justify-between gap-3 rounded-md text-left ${classes.themeTransition} ${classes.buttonHover}`}
              >
                <div className="flex items-center min-w-0">
                  {userProfile?.profile_image_url ? (
                    <img
                      src={userProfile.profile_image_url}
                      alt="User Avatar"
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="rounded-full w-10 h-10 bg-[#c2410c] flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold">
                      {(userProfile.name || userProfile.email || 'U').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="ml-3 min-w-0">
                    <div className="truncate text-sm font-medium">{userProfile.name || 'Demo User'}</div>
                    <div className={`truncate text-xs ${classes.mutedText}`}>{userProfile.email}</div>
                  </div>
                </div>
                <ChevronUp
                  size={16}
                  className={`${classes.mutedText} ${classes.themeTransition} ${isUserMenuOpen ? 'rotate-0' : 'rotate-180'}`}
                />
              </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;
