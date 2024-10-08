import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Spin } from 'antd';
import NavHeader from '../components/NavHeader';
import { useLanguage, useAuth } from '../hooks';
import { useTheme } from '../contexts/ThemeContext';
import { userSignIn, userSignUp, checkAuthStatus } from '../apis/auths';


const LoginSignupForm = ({ WEBUI_NAME }) => {
  const navigate = useNavigate();
  const { classes } = useTheme();
  const { t } = useLanguage();
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { isLoggedIn } = useAuth();
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleAuth = async (authFunc, successMessage) => {
    setLoading(true);
    try {
      const res = await authFunc({ email, password, ...(mode === 'signup' && { name, profile_image_url: '' }) });
      if (res.statusText === 'OK') {
        const { token, token_type } = res.data;
        localStorage.setItem('token', `${token_type} ${token}`);
        message.success(successMessage);
        await sleep(2000);
        navigate('/', { replace: true });
      }
    } catch (error) {
      message.error(error?.response?.data?.detail || t('Something went wrong!'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'signin') {
      await handleAuth(userSignIn, t('登录成功！'));
    } else {
      await handleAuth(userSignUp, t('账号注册成功！'));
    }
  };
  useEffect(() => {
    if (isLoggedIn) {
      message.info(t('您已经登录，正在跳转...'));
      sleep(2000)
      navigate('/', { replace: true });
    };
  }, [isLoggedIn]);
  return (
    <div className={`${classes.bg} ${classes.text} min-h-screen w-full flex items-center flex-col font-primary`}>
      <div className="ml-auto px-4">
        <NavHeader />
      </div>
      <div className="w-full flex-1 sm:max-w-md px-10 flex flex-col text-center">
        <Spin spinning={loading} delay={500}>
          <div className="mt-20 pb-10 w-full dark:text-gray-100">
            <form className="flex flex-col justify-center" onSubmit={handleSubmit}>
              <div className="mb-1">
                <div className="text-2xl font-medium">
                  {mode === 'signin' ? t('Sign in') : t('Sign up')} {t('to')} {WEBUI_NAME}
                </div>
                {mode === 'signup' && (
                  <div className="mt-1 text-xs font-medium text-gray-500">
                    ⓘ {WEBUI_NAME} {t(
                      'does not make any external connections, and your data stays securely on your locally hosted server.'
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col mt-4">
                {mode === 'signup' && (
                  <>
                    <div>
                      <div className="text-sm font-medium text-left mb-1">{t('Name')}</div>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        type="text"
                        className={`px-5 py-3 rounded-2xl w-full text-sm outline-none border ${classes.input}`}
                        autoComplete="name"
                        placeholder={t('Enter Your Full Name')}
                        required
                      />
                    </div>
                    <hr className={`my-3 ${classes.border}`} />
                  </>
                )}

                <div className="mb-2">
                  <div className="text-sm font-medium text-left mb-1">{t('Email')}</div>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    className={`px-5 py-3 rounded-2xl w-full text-sm outline-none border ${classes.input}`}
                    autoComplete="email"
                    placeholder={t('Enter Your Email')}
                    required
                  />
                </div>

                <div>
                  <div className="text-sm font-medium text-left mb-1">{t('Password')}</div>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    className={`px-5 py-3 rounded-2xl w-full text-sm outline-none border ${classes.input}`}
                    placeholder={t('Enter Your Password')}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </div>

              <div className="mt-5">
                <button
                  className="bg-gray-950 hover:bg-gray-900 w-full rounded-2xl text-white font-medium text-sm py-3 transition"
                  type="submit"
                >
                  {mode === 'signin' ? t('Sign in') : t('Create Account')}
                </button>

                <div className="mt-4 text-sm text-center">
                  {mode === 'signin'
                    ? t("Dont have an account?")
                    : t('Already have an account?')}
                  <button
                    className="font-medium underline"
                    type="button"
                    onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                  >
                    {mode === 'signin' ? t('Sign up') : t('Sign in')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </Spin>
      </div>
    </div>
  );
};

export default LoginSignupForm;
