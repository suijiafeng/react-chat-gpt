// 输入法（中文 / 日文等）组字时按下的 Enter 是在确认候选词，不是在发送。
//
// 只看 e.key === 'Enter' 会把还没上屏的拼音发出去。isComposing 在部分浏览器的
// keydown 上已经是 false，但 keyCode / which 仍是 229（IME 处理中的兼容信号），
// 所以两个条件都要看。React 合成事件与原生事件都可能带这些字段。

export function isImeComposing(event) {
  if (!event) return false;
  const native = event.nativeEvent;
  const isComposing = Boolean(event.isComposing || native?.isComposing);
  const keyCode = event.keyCode ?? native?.keyCode;
  const which = event.which ?? native?.which;
  return isComposing || keyCode === 229 || which === 229;
}

/** Enter 提交：Shift+Enter 留给换行；组字中的 Enter 留给输入法。 */
export function shouldSubmitOnEnter(event) {
  if (!event || event.key !== 'Enter' || event.shiftKey) return false;
  return !isImeComposing(event);
}
