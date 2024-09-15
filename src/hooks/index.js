import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { checkAuthStatus } from '../apis/auths';
import {userStore} from '../store'

export const useLanguage = () => {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    // 从 localStorage 读取语言设置，如果没有则使用默认语言
    const savedLanguage = localStorage.getItem('appLanguage');
    if (savedLanguage) {
      i18n.changeLanguage(savedLanguage);
    }
  }, [i18n]);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    // 将新的语言设置保存到 localStorage
    localStorage.setItem('appLanguage', lng);
  };

  return {
    t,
    language: i18n.language,
    changeLanguage,
  };
};

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await checkAuthStatus();
  
        if(res.statusText === "OK") {
          setIsLoggedIn(true);
          userStore.setUser({
            ...res.data
          });
        }
      } catch (error) {
        console.error('Authentication check failed', error);
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, []);

  return { isLoggedIn, isLoading };
};