/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // 全站字号统一为偶数。整体上提一档后：正文 18px，次要 16px，装饰 14px
    fontSize: {
      xs: ['12px', '18px'],     // 备用最小号，当前无使用
      sm: ['14px', '22px'],     // 装饰性文字（计数、文件大小、标签）
      base: ['16px', '26px'],   // 次要信息、表单标签、按钮
      lg: ['18px', '28px'],     // 默认正文
      xl: ['20px', '30px'],
      '2xl': ['24px', '32px'],
      '3xl': ['28px', '36px'],
      '4xl': ['36px', '44px'],
      '5xl': ['48px', '56px'],
      '6xl': ['60px', '68px'],
    },
    extend: {
      animation: {
        'spin-slow': 'spin 2s linear infinite',
      }
    },
  },
  plugins: [],
}

