import React, { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Loader } from 'lucide-react';

const DEFAULT_AVATARS = {
  user: '/user_avatar.png',
  ai: '/ai_avatar.png',
};

const DEFAULT_NAMES = {
  user: 'You',
  ai: 'AI Assistant',
};

const Avatar = ({ src, alt, isUser }) => (
  <img
    src={src}
    alt={alt}
    className={`w-10 h-10 rounded-full object-cover ${isUser ? 'ml-2' : 'mr-2'}`}
  />
);

const ChatMessage = React.memo(({ message, isTyping, isUser, avatar, username }) => {
  const { isDark, classes } = useTheme();

  const messageAvatar = useMemo(() => avatar || (isUser ? DEFAULT_AVATARS.user : DEFAULT_AVATARS.ai), [avatar, isUser]);
  const messageName = useMemo(() => username || (isUser ? DEFAULT_NAMES.user : DEFAULT_NAMES.ai), [username, isUser]);

  const containerClasses = `flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`;
  const contentContainerClasses = `flex flex-col max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`;
  const messageClasses = `
    ${classes.border} rounded-2xl px-4 py-2 border 
    ${isUser ? (isDark ? 'bg-gray-700' : 'bg-white text-black') : (isDark ? 'bg-gray-800' : 'bg-white text-black')}
  `;
  return (
    <div className={containerClasses}>
      {!isUser && <Avatar src={messageAvatar} alt={`${messageName}'s avatar`} isUser={isUser} />}
      <div className={contentContainerClasses}>
        <span className="text-sm text-gray-600 mb-1">{messageName}</span>
        <div className={messageClasses}>
          <>
            <span className="message-text break-words">{message}</span>
            {isTyping && (message ? <span className="typing-cursor animate-pulse">|</span> :
              <Loader size={24} className={`${classes.text} animate-spin-slow`} />
            )}
          </>
        </div>
      </div>
      {isUser && <Avatar src={messageAvatar} alt={`${messageName}'s avatar`} isUser={isUser} />}
    </div>
  );
});

export default ChatMessage;
