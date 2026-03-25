/**
 * BaseProvider serves as the abstract base class for all LLM service adapters.
 */
export class BaseProvider {
  /**
   * Complete the chat conversation using streaming.
   * Subclasses implement (params, callback, signal).
   */
  async complete() {
    throw new Error('complete() method must be implemented by subclasses');
  }

  /**
   * Helper utility for parsing SSE streams robustly.
   * @param {ReadableStream} streamBody - Readable stream from fetch response
   * @param {Function} callback - Callback function for raw content chunks or '[DONE]'
   * @param {AbortSignal} signal - Abort signal
   * @param {Function} dataParser - Function to extract content from parsed JSON of a 'data: ' line
   */
  async parseStream(streamBody, callback, signal, dataParser) {
    const reader = streamBody.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    // 是否解析到过至少一行合法 data: ——用于识别"200 但响应体根本不是 SSE"
    // （个别兼容平台把错误 JSON/HTML 用 200 直接返回），避免用户对着空白气泡困惑
    let sawData = false;
    let rawSample = ''; // 前几百字节原文，报错时帮助定位问题
    // [DONE] 只向下游发一次：数据行里的 [DONE] 与流关闭后的兜底不重复触发，
    // 否则 useChat 的收尾逻辑（入库、touchSession、生成标题）会被执行两遍
    let doneSent = false;

    // dataParser 可返回单个块或块数组——同一个 delta 可能同时携带可见文本与
    // 思考文本（如 <think> 标签在 chunk 中间闭合），需要拆成两次回调
    const emit = (parsedChunk) => {
      for (const chunk of Array.isArray(parsedChunk) ? parsedChunk : [parsedChunk]) {
        if (!chunk) continue;
        if (typeof chunk === 'object' && 'content' in chunk) {
          callback(chunk.content, chunk.meta);
        } else {
          callback(chunk);
        }
      }
    };

    const sendDone = () => {
      if (doneSent) return;
      doneSent = true;
      callback('[DONE]');
    };

    // 处理一行 SSE 数据（读循环与流关闭后的尾部缓冲共用同一套逻辑）。
    // SSE 规范里 "data:" 后的空格是可选的——部分平台/网关发 data:{...}（无空格），
    // 只认 "data: " 会把整条流静默忽略掉
    const handleLine = (line) => {
      const cleanedLine = line.trim();
      if (!cleanedLine.startsWith('data:')) return;

      const dataStr = cleanedLine.slice(5).trim();
      if (dataStr === '[DONE]') {
        sawData = true;
        sendDone();
        return;
      }

      try {
        const parsed = JSON.parse(dataStr);
        sawData = true;
        emit(dataParser(parsed));
      } catch (e) {
        console.error('Error parsing SSE line:', e, cleanedLine);
      }
    };

    try {
      while (true) {
        if (signal?.aborted) {
          // 优先抛出调用方传入的真实中止原因（比如超时看门狗构造的 TimeoutError），
          // 而不是一律说成通用 AbortError——上层需要靠 error.name 区分
          // "用户手动点了停止"和"请求卡住被自动中止"，两者的 UI 表现不同。
          throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
        }

        const { value, done } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        buffer += text;
        if (rawSample.length < 500) rawSample += text.slice(0, 500 - rawSample.length);
        const lines = buffer.split('\n');

        // Keep the last partial line
        buffer = lines.pop() || '';
        lines.forEach(handleLine);
      }

      // Check remaining buffer
      if (buffer.trim()) {
        handleLine(buffer);
      }

      // 响应结束却没有任何合法 SSE 行：多半是平台把错误 JSON/HTML 用 200 返回了。
      // 抛错交给上层展示为错误气泡，而不是留给用户一个悄无声息的空白回复。
      if (!sawData && rawSample.trim()) {
        throw new Error(`响应不是有效的流式格式：${rawSample.trim().slice(0, 200)}`);
      }

      // Finally signal termination
      sendDone();
    } finally {
      reader.releaseLock();
    }
  }
}
