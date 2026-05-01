import React from 'react';

/**
 * React 错误边界：子树渲染抛错时展示降级内容，而不是让整个应用白屏。
 *
 * 两种用法：
 * - 应用级：包住路由，任何页面崩溃都有兜底提示 + 刷新按钮；
 * - 消息级：包住单条消息的 Markdown 渲染，异常内容只降级该条消息（fallback 展示纯文本），
 *   不影响会话其余部分。
 *
 * resetKey 变化时自动清除错误重试渲染（流式消息下一个 chunk 到达即重试）。
 */
export class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('渲染错误已被边界捕获：', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (this.state.error) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            minHeight: '60vh',
            padding: 24,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600 }}>页面出了点问题</div>
          <div style={{ fontSize: 13, opacity: 0.65 }}>
            {String(this.state.error?.message || this.state.error).slice(0, 200)}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 20px',
              borderRadius: 9999,
              border: '1px solid rgba(128,128,128,0.35)',
              cursor: 'pointer',
              background: 'transparent',
              color: 'inherit',
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
