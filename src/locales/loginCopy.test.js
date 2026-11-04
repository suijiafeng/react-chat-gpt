import { describe, it, expect } from 'vitest';
import i18n from './i18n';
import zh from './zh/translation.json';
import en from './en/translation.json';

describe('登录页标题', () => {
  it('中文是「登录 AI Chat」，不再插入介词「的」', async () => {
    await i18n.changeLanguage('zh');
    expect(i18n.t('signInTitle', { name: 'AI Chat' })).toBe('登录 AI Chat');
    expect(i18n.t('signUpTitle', { name: 'AI Chat' })).toBe('注册 AI Chat');
    expect(zh).not.toHaveProperty('to');
  });

  it('英文保留 to / for', async () => {
    await i18n.changeLanguage('en');
    expect(i18n.t('signInTitle', { name: 'AI Chat' })).toBe('Sign in to AI Chat');
    expect(i18n.t('signUpTitle', { name: 'AI Chat' })).toBe('Sign up for AI Chat');
    expect(en).not.toHaveProperty('to');
  });
});

describe('404 文案', () => {
  it('中英文都有译文，页面不会露出 key', () => {
    expect(zh.pageNotFound).toBe('页面不存在');
    expect(zh.backToHome).toBe('返回首页');
    expect(en.pageNotFound).toBe('Page not found');
    expect(en.backToHome).toBe('Back to home');
  });
});
