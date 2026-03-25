// parseStream 的故障注入测试。
// 覆盖大模型返回数据格式异常与消息中断的各类场景：
// data: 无空格变体、流中错误对象、200 但响应体不是 SSE、拦腰截断、坏行跳过等。
import { describe, it, expect, vi } from 'vitest';
import { BaseProvider } from './base';

const mkStream = (chunks) =>
  new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(new TextEncoder().encode(c));
      controller.close();
    },
  });

// 复刻真实 provider dataParser 的语义：error 对象 → 错误块；delta.content → 内容
const parser = (parsed) => {
  if (parsed.error) {
    return { content: `上游返回错误：${parsed.error.message || ''}`, meta: { isError: true } };
  }
  const delta = parsed.choices?.[0]?.delta;
  return delta?.content ? { content: delta.content } : null;
};

const run = async (chunks) => {
  const out = [];
  const bp = new BaseProvider();
  try {
    await bp.parseStream(
      mkStream(chunks),
      (content, meta) => out.push({ content, isError: Boolean(meta?.isError) }),
      new AbortController().signal,
      parser
    );
    return { out, threw: null };
  } catch (e) {
    return { out, threw: e.message };
  }
};

describe('parseStream 格式兼容', () => {
  it('data: 无空格变体可正常解析（SSE 规范中空格可选）', async () => {
    const r = await run(['data:{"choices":[{"delta":{"content":"甲"}}]}\n\n', 'data:[DONE]\n\n']);
    expect(r.out.some((o) => o.content === '甲')).toBe(true);
    expect(r.out.some((o) => o.content === '[DONE]')).toBe(true);
  });

  it('CRLF 行尾与 SSE 注释行不影响解析', async () => {
    const r = await run([
      ': keep-alive\r\ndata: {"choices":[{"delta":{"content":"X"}}]}\r\n\r\ndata: [DONE]\r\n',
    ]);
    expect(r.out.some((o) => o.content === 'X')).toBe(true);
  });

  it('中间坏 JSON 行跳过后继续解析', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await run([
      'data: {坏掉的}\n',
      'data: {"choices":[{"delta":{"content":"后续正常"}}]}\n',
      'data: [DONE]\n',
    ]);
    expect(r.out.some((o) => o.content === '后续正常')).toBe(true);
    spy.mockRestore();
  });

  it('dataParser 返回数组时逐块回调（可见文本 + 思考文本双通道）', async () => {
    const out = [];
    const bp = new BaseProvider();
    await bp.parseStream(
      mkStream(['data: {"x":1}\n', 'data: [DONE]\n']),
      (content, meta) => out.push({ content, r: Boolean(meta?.isReasoning) }),
      new AbortController().signal,
      () => [
        { content: '思考', meta: { isReasoning: true } },
        { content: '正文' },
      ]
    );
    expect(out.filter((o) => o.r).map((o) => o.content)).toEqual(['思考']);
    expect(out.some((o) => o.content === '正文' && !o.r)).toBe(true);
  });
});

describe('parseStream 异常与中断', () => {
  it('流中错误对象转为 isError 块，已收内容保留', async () => {
    const r = await run([
      'data: {"choices":[{"delta":{"content":"部分内容"}}]}\n\n',
      'data: {"error":{"message":"quota exceeded"}}\n\n',
      'data: [DONE]\n\n',
    ]);
    expect(r.out.some((o) => o.isError && o.content.includes('quota'))).toBe(true);
    expect(r.out.some((o) => o.content === '部分内容')).toBe(true);
  });

  it('200 但响应体是纯 JSON 错误（无任何 SSE 行）时抛格式错误', async () => {
    const r = await run(['{"error":{"message":"invalid api key"},"code":401}']);
    expect(r.threw).toMatch(/响应不是有效的流式格式/);
  });

  it('流被拦腰截断（半截 JSON、无 [DONE]）：已收内容保留且正常收尾', async () => {
    const r = await run([
      'data: {"choices":[{"delta":{"content":"完整部分"}}]}\n',
      'data: {"choices":[{"delta":{"content":"被截',
    ]);
    expect(r.threw).toBeNull();
    expect(r.out.some((o) => o.content === '完整部分')).toBe(true);
    expect(r.out.at(-1).content).toBe('[DONE]');
  });

  it('合法 SSE 但零内容的空回复不误报格式错误', async () => {
    const r = await run(['data: {"choices":[{"delta":{}}]}\n', 'data: [DONE]\n']);
    expect(r.threw).toBeNull();
  });

  it('中止信号带 reason 时抛出真实原因（TimeoutError 看门狗场景）', async () => {
    const controller = new AbortController();
    controller.abort(new DOMException('模型长时间无响应', 'TimeoutError'));
    const bp = new BaseProvider();
    await expect(
      bp.parseStream(
        mkStream(['data: {"choices":[{"delta":{"content":"x"}}]}\n']),
        () => {},
        controller.signal,
        parser
      )
    ).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
