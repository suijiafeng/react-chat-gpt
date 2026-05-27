import { describe, it, expect } from 'vitest';
import { sortSessions, filterSessionsByUser } from './db';

// sortSessions 是纯函数，不触碰 IndexedDB，可直接在 node 环境测试
describe('sortSessions', () => {
  it('置顶会话排在前面', () => {
    const input = [{ id: 'a' }, { id: 'b', pinned: true }, { id: 'c' }];
    expect(sortSessions(input).map((s) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('稳定排序：组内保持原有顺序（updatedAt 倒序由调用方保证）', () => {
    const input = [
      { id: 'new' },
      { id: 'p1', pinned: true },
      { id: 'old' },
      { id: 'p2', pinned: true },
    ];
    expect(sortSessions(input).map((s) => s.id)).toEqual(['p1', 'p2', 'new', 'old']);
  });

  it('缺省 pinned 视为未置顶，且不修改原数组', () => {
    const input = [{ id: 'a', pinned: true }, { id: 'b', pinned: undefined }];
    const out = sortSessions(input);
    expect(out.map((s) => s.id)).toEqual(['a', 'b']);
    expect(input).not.toBe(out);
  });
});

describe('filterSessionsByUser', () => {
  it('只保留当前用户的会话', () => {
    const input = [
      { id: 'a', userId: 'u1' },
      { id: 'b', userId: 'u2' },
      { id: 'c', userId: 'u1' },
    ];
    expect(filterSessionsByUser(input, 'u1').map((s) => s.id)).toEqual(['a', 'c']);
  });

  it('无 userId 的存量会话对任何用户可见（由读取方惰性认领）', () => {
    const input = [{ id: 'legacy' }, { id: 'b', userId: 'u2' }];
    expect(filterSessionsByUser(input, 'u1').map((s) => s.id)).toEqual(['legacy']);
    expect(filterSessionsByUser(input, 'u2').map((s) => s.id)).toEqual(['legacy', 'b']);
  });
});
