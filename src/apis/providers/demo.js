import { BaseProvider } from './base';
import { buildDemoReply } from '../../constants/demoReplies';

export class DemoProvider extends BaseProvider {
  async complete(params, callback, signal) {
    const { messages } = params;
    const reply = buildDemoReply(messages);
    
    // 逐字符发送，标点/换行后加额外停顿，模拟真实打字节奏
    const PAUSE = { '。': 120, '！': 120, '？': 120, '，': 60, '、': 60, '\n': 80 };
    const BASE = 22; // 基础每字符延迟 ms
    const JITTER = 18; // 随机抖动范围

    for (let i = 0; i < reply.length; i++) {
      if (signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      const char = reply[i];
      callback(char);

      const extra = PAUSE[char] ?? 0;
      const delay = BASE + extra + Math.random() * JITTER;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    callback('[DONE]');
  }
}
