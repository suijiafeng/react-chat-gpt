import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslations from './en/translation.json';
import zhTranslations from './zh/translation.json';

// 启动时直接同步读取已保存的语言偏好，避免先用默认语言渲染、
// 再在 useLanguage 的 useEffect 里切换造成的“闪一下中文/英文”问题
const getInitialLanguage = () => {
  try {
    return (typeof window !== 'undefined' && window.localStorage.getItem('appLanguage')) || 'zh';
  } catch {
    return 'zh';
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      zh: { translation: zhTranslations },
    },
    lng: getInitialLanguage(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });

export default i18n;