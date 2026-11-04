import { describe, it, expect } from 'vitest';
import { isImeComposing, shouldSubmitOnEnter } from './ime';

describe('isImeComposing', () => {
  it('组字中（isComposing）视为输入法处理中', () => {
    expect(isImeComposing({ isComposing: true, keyCode: 13 })).toBe(true);
  });

  it('keyCode / which 为 229 时视为输入法处理中', () => {
    expect(isImeComposing({ isComposing: false, keyCode: 229 })).toBe(true);
    expect(isImeComposing({ which: 229 })).toBe(true);
  });

  it('从 React 合成事件的 nativeEvent 上读取', () => {
    expect(isImeComposing({ nativeEvent: { isComposing: true, keyCode: 229 } })).toBe(true);
    expect(isImeComposing({ keyCode: undefined, nativeEvent: { keyCode: 229 } })).toBe(true);
  });

  it('普通按键不是组字', () => {
    expect(isImeComposing({ key: 'Enter', keyCode: 13, which: 13, isComposing: false })).toBe(false);
    expect(isImeComposing(null)).toBe(false);
  });
});

describe('shouldSubmitOnEnter', () => {
  it('单独的 Enter 提交', () => {
    expect(shouldSubmitOnEnter({ key: 'Enter', keyCode: 13, isComposing: false })).toBe(true);
  });

  it('Shift+Enter 不提交（留给换行）', () => {
    expect(shouldSubmitOnEnter({ key: 'Enter', shiftKey: true, keyCode: 13 })).toBe(false);
  });

  it('组字确认候选时不提交', () => {
    expect(shouldSubmitOnEnter({ key: 'Enter', isComposing: true, keyCode: 229 })).toBe(false);
    expect(shouldSubmitOnEnter({ key: 'Enter', isComposing: false, keyCode: 229 })).toBe(false);
  });

  it('其他按键不提交', () => {
    expect(shouldSubmitOnEnter({ key: 'a', keyCode: 65 })).toBe(false);
    expect(shouldSubmitOnEnter(undefined)).toBe(false);
  });
});
