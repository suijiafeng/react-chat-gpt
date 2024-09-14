import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Spinner from '../components/Spinner';
import NavHeader from '../components/NavHeader';
import { useLanguage } from '../hooks';
import { useTheme, withTheme } from '../contexts/ThemeContext';

const LoginSignupForm = ({ config, i18n, WEBUI_NAME, WEBUI_BASE_URL }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { t } = useLanguage()
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    setLoaded(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Implement sign in / sign up logic here
  };

  if (!loaded) return null;

  return (
    <div className={`${theme.bg} min-h-screen w-full flex items-center flex-col font-primary`}>
      <div className='ml-auto'>
        <NavHeader />
      </div>
      <div className="w-full flex-1 sm:max-w-md px-10 flex flex-col text-center">
        <div className="mt-20 pb-10 w-full dark:text-gray-100">
          <form className="flex flex-col justify-center" onSubmit={handleSubmit}>
            <div className="mb-1">
              <div className="text-2xl font-medium">
                {mode === 'signin' ? t('Sign in') : t('Sign up')}
                {t('to')}
                {WEBUI_NAME}
              </div>
              {mode === 'signup' && (
                <div className="mt-1 text-xs font-medium text-gray-500">
                  ⓘ {WEBUI_NAME}
                  {t(
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
                      className={`px-5 py-3 rounded-2xl w-full text-sm outline-none border ${theme.input}`}
                      autoComplete="name"
                      placeholder={t('Enter Your Full Name')}
                      required
                    />
                  </div>
                  <hr className={`my-3 ${theme.border}`} />
                </>
              )}

              <div className="mb-2">
                <div className="text-sm font-medium text-left mb-1">{t('Email')}</div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className={`px-5 py-3 rounded-2xl w-full text-sm outline-none border ${theme.input}`}
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
                  className={`px-5 py-3 rounded-2xl w-full text-sm outline-none border ${theme.input}`}
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
      </div>
    </div>
  );
};

export default withTheme(LoginSignupForm);