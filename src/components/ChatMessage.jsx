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
    className={`w-9 h-9 rounded-full object-cover ${isUser ? 'ml-3' : 'mr-3'}`}
  />
);
const LoadingIndicator = ({ message, classes }) => {
  return message ? <span className="typing-cursor animate-pulse">|</span> : (
    <div className="flex justify-center  text-sm">
      <Loader size={18} className={`${classes.text} animate-spin-slow`} />
    </div>
  );
};
const ChatMessage = React.memo(({ message, isTyping, isUser, avatar, username }) => {
  const { isDark, classes } = useTheme();

  const messageAvatar = useMemo(
    () => avatar || (isUser ? DEFAULT_AVATARS.user : DEFAULT_AVATARS.ai),
    [avatar, isUser]
  );
  const messageName = useMemo(
    () => username || (isUser ? DEFAULT_NAMES.user : DEFAULT_NAMES.ai),
    [username, isUser]
  );

  const containerClasses = `flex mb-8 ${isUser ? 'justify-end' : 'justify-start'}`;
  const contentContainerClasses = `flex flex-col max-w-[min(720px,82%)] ${
    isUser ? 'items-end' : 'items-start'
  }`;
  const messageClasses = `
    px-5 py-2 text-[15px] leading-7
    ${
      isUser
        ? isDark
          ? 'rounded-[28px] bg-white/[0.06] text-white'
          : 'rounded-[28px] bg-black/[0.04] text-black'
        : 'bg-transparent text-inherit'
    }
  `;

  return (
    <div className={containerClasses}>
      {/* {!isUser && <Avatar src={messageAvatar} alt={`${messageName}'s avatar`} isUser={isUser} />} */}
      <div className={contentContainerClasses}>
        {/* <span className={`mb-2 text-xs font-medium uppercase tracking-[0.18em] ${classes.mutedText}`}>
          {messageName}
        </span> */}
        <div className={messageClasses}>
          <span className="message-text whitespace-pre-wrap break-words">{message}</span>
          {isTyping && <LoadingIndicator message={message} classes={classes} />}
        </div>
      </div>
      {/* {isUser && <Avatar src={messageAvatar} alt={`${messageName}'s avatar`} isUser={isUser} />} */}
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';

export default ChatMessage;
