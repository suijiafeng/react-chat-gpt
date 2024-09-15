import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { Loader } from 'lucide-react';

const DEFAULT_AVATARS = {
  user: 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y',
  ai: 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=identicon&f=y',
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

const ChatMessage = React.memo(({
  message,
  isUser,
  isTyping,
  avatar,
  username,
}) => {
  const { isDark, classes } = useTheme();

  const messageAvatar = avatar || (isUser ? DEFAULT_AVATARS.user : DEFAULT_AVATARS.ai);
  const messageName = username || (isUser ? DEFAULT_NAMES.user : DEFAULT_NAMES.ai);

  const containerClasses = `flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`;
  const contentContainerClasses = `flex flex-col max-w-[70%] ${isUser ? 'items-end' : 'items-start'}`;
  const messageClasses = ` ${classes.border}
    ${isDark
      ? isUser ? 'bg-gray-700' : 'bg-gray-800'
      : 'bg-white text-black'
    } 
    rounded-2xl px-4 py-2 border
  `;

  return (
    <div className={containerClasses}>
      {!isUser && <Avatar src={messageAvatar} alt={`${messageName}'s avatar`} isUser={isUser} />}
      <div className={contentContainerClasses}>
        <span className="text-sm text-gray-600 mb-1">{messageName}</span>
        <div className={messageClasses}>
          {message && <span className="message-text break-words">{message}</span>}
          {isTyping && message && <span className="typing-cursor animate-pulse">|</span>}
          {!message && <Loader size="24" className={`${classes.text} animate-spin-slow`} />}
        </div>
      </div>
      {isUser && <Avatar src={messageAvatar} alt={`${messageName}'s avatar`} isUser={isUser} />}
    </div>
  );
});

export default ChatMessage;