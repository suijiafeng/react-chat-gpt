// 在 React 挂载之前就把背景色定下来，避免刷新时先出现默认色，
// 再被 ThemeContext 的过渡动画"闪"一下切到真正的主题色。
// 独立成外部文件是为了兼容 CSP script-src 'self'（不允许内联脚本）。
(function () {
  try {
    var isDark = JSON.parse(localStorage.getItem('isDarkTheme') || 'false');
    var page = isDark ? '#212121' : '#f7f7f8';
    document.documentElement.style.background = page;
    document.documentElement.style.setProperty('--page-bg', page);
    document.documentElement.style.setProperty('--ink', isDark ? '#ececec' : '#1f1f1f');
    if (isDark) document.documentElement.classList.add('dark-theme');
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#3b82f6');
  } catch {
    // 读取失败按浅色主题处理，不影响后续 React 正常接管
  }
})();
