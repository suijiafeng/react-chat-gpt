import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 只跑前端单测；server/ 下的测试用 node 内置 test runner（npm run test:server）
    include: ['src/**/*.test.js'],
    environment: 'node', // 被测模块是纯逻辑（流解析/分流器），无需 jsdom
  },
});
