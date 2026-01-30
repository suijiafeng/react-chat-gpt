/**
 * BaseProvider serves as the abstract base class for all LLM service adapters.
 */
export class BaseProvider {
  /**
   * Complete the chat conversation using streaming.
   * @param {Object} params - completion options (messages, model, chat_id, options, stream, etc.)
   * @param {Function} callback - stream chunk callback function
   * @param {AbortSignal} signal - signal for aborting request
   */
  async complete(params, callback, signal) {
    if (!params || !callback || !signal) {
      // Reference parameters to prevent eslint unused-vars
    }
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

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last partial line
        buffer = lines.pop() || '';

        for (const line of lines) {
          const cleanedLine = line.trim();
          if (!cleanedLine) continue;

          if (cleanedLine === 'data: [DONE]') {
            callback('[DONE]');
            continue;
          }

          if (cleanedLine.startsWith('data: ')) {
            const dataStr = cleanedLine.slice(6).trim();
            if (dataStr === '[DONE]') {
              callback('[DONE]');
              continue;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const parsedChunk = dataParser(parsed);
              if (parsedChunk) {
                if (typeof parsedChunk === 'object' && 'content' in parsedChunk) {
                  callback(parsedChunk.content, parsedChunk.meta);
                } else {
                  callback(parsedChunk);
                }
              }
            } catch (e) {
              console.error('Error parsing SSE line:', e, cleanedLine);
            }
          }
        }
      }

      // Check remaining buffer
      if (buffer.trim()) {
        const cleanedLine = buffer.trim();
        if (cleanedLine.startsWith('data: ')) {
          const dataStr = cleanedLine.slice(6).trim();
          if (dataStr !== '[DONE]') {
            try {
              const parsed = JSON.parse(dataStr);
              const parsedChunk = dataParser(parsed);
              if (parsedChunk) {
                if (typeof parsedChunk === 'object' && 'content' in parsedChunk) {
                  callback(parsedChunk.content, parsedChunk.meta);
                } else {
                  callback(parsedChunk);
                }
              }
            } catch {
              // ignore
            }
          }
        }
      }

      // Finally signal termination
      callback('[DONE]');
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Stream aborted');
        throw error;
      }
      throw error;
    } finally {
      reader.releaseLock();
    }
  }
}
