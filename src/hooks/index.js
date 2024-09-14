import { useTranslation } from 'react-i18next';
export const useLanguage = () => {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };
  return {
    t,
    language: i18n.language,
    changeLanguage,
  };
};

