// 在 React 挂载之前就把背景色定下来，避免刷新时先出现默认色，
// 再被 ThemeContext 的过渡动画"闪"一下切到真正的主题色。
// 独立成外部文件是为了兼容 CSP script-src 'self'（不允许内联脚本）。
(function () {
  try {
    var isDark = JSON.parse(localStorage.getItem('isDarkTheme') || 'false');
    document.documentElement.style.background = isDark ? '#212121' : '#f7f7f8';
    // 同步挂上 .dark-theme：Tailwind 的 dark: 变体依赖这个类（见 tailwind.config.js
    // 的 darkMode 配置）。等 React 挂载后再加会先闪一帧亮色边框。
    if (isDark) document.documentElement.classList.add('dark-theme');
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch {
    // 读取失败按浅色主题处理，不影响后续 React 正常接管
  }
})();
