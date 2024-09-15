import React from 'react';
import { Plus, MessageSquare, X, User } from "lucide-react";
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../hooks';
import { userStore } from '../store'

const Sidebar = React.memo(({ isOpen, onClose }) => {
  const { isDark, border } = useTheme();
  const { t } = useLanguage();
  const { userProfile } = userStore;

  return (
    <div
      className={`fixed lg:relative top-0 left-0 flex flex-col h-full border-r shadow-md ${isDark
          ? "bg-[#171717] text-white border-gray-700"
          : "bg-white text-black border-gray-200"
        } transition-all duration-300 ease-in-out ${isOpen ? "w-64" : "w-0"
        } overflow-hidden z-50`}
    >
      <div className="w-64 flex-1 flex flex-col">
        <div className="px-4 flex justify-between h-[65px] items-center">
          <h2 className="text-xl font-bold">ChatGPT</h2>
          <button
            onClick={onClose}
            className={`${isDark
                ? "text-gray-300 hover:text-white"
                : "text-gray-500 hover:text-gray-700"
              } mr-4 transition-colors duration-200 lg:hidden`}
          >
            <X size={24} />
          </button>
        </div>
        <div className="px-4">
          <button
            className={`flex items-center ${isDark
                ? "text-white hover:bg-[#212121]"
                : "text-black hover:bg-gray-200"
              } w-full p-2 rounded transition-colors duration-200`}
          >
            <Plus size={18} className="mr-2" />
            {t("newChat")}
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <div
            className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"
              } mb-2`}
          >
            {t("recentChats")}
          </div>
          {[1, 2].map((chat) => (
            <button
              key={chat}
              className={`flex items-center ${isDark
                  ? "text-white hover:bg-[#212121]"
                  : "text-black hover:bg-gray-200"
                } w-full p-2 rounded transition-colors duration-200`}
            >
              <MessageSquare size={18} className="mr-2" />
              {t("chat")} {chat}
            </button>
          ))}
        </div>
        {userProfile && (
          <div className="p-4">
            <div className={`flex items-center rounded-md py-2 px-2 ${isDark ? 'hover:bg-[#212121]' : 'hover:bg-gray-200'
              } cursor-pointer transition-colors duration-300`}>
              {userProfile?.profile_image_url ? (
                <img
                  src={userProfile.profile_image_url}
                  alt="User Avatar"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className='rounded-full w-8 h-8 bg-gray-300 flex items-center justify-center'>
                  <User size={20} className={isDark ? 'text-gray-700' : 'text-gray-500'} />
                </div>
              )}
              <div className='ml-2 text-sm truncate'>{userProfile.email}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

export default Sidebar;