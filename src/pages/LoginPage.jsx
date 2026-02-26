import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message, Spin } from 'antd';
import { Eye, EyeOff } from 'lucide-react';
import NavHeader from '../components/NavHeader';
import AppLogo from '../components/AppLogo';
import { useLanguage, useAuth } from '../hooks';
import { useTheme } from '../contexts/ThemeContext';
import { userSignIn, userSignUp } from '../apis/auths';
import { userStore } from '../store';
import { USE_LOCAL_DATA } from '../constants';

// 仅在本地演示构建里预填演示账号，方便一键体验；接了真实后端时不预填凭据，
// 避免向用户暗示一组在真实环境里并不存在（或不该存在）的弱口令。
const DEMO_EMAIL = USE_LOCAL_DATA ? 'demo@example.com' : '';
const DEMO_PASSWORD = USE_LOCAL_DATA ? 'demo123' : '';

// 带眼睛切换的密码输入框
const PasswordInput = ({ value, onChange, placeholder, autoComplete, classes }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        value={value}
        onChange={onChange}
        type={visible ? 'text' : 'password'}
        className={`px-5 py-3 pr-12 rounded-2xl w-full text-sm outline-none border ${classes.input} ${classes.themeTransition}`}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className={`absolute right-4 top-1/2 -translate-y-1/2 ${classes.mutedText} hover:opacity-80`}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

const LoginSignupForm = ({ WEBUI_NAME }) => {
  const navigate = useNavigate();
  const { classes } = useTheme();
  const { t } = useLanguage();
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { isLoggedIn } = useAuth();

  const switchMode = (next) => {
    setMode(next);
    setName('');
    setConfirmPassword('');
    if (next === 'signin') {
      setEmail(DEMO_EMAIL);
      setPassword(DEMO_PASSWORD);
    } else {
      setEmail('');
      setPassword('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (mode === 'signup' && password !== confirmPassword) {
      message.error(t('passwordMismatch'));
      return;
    }
    setLoading(true);
    try {
      let session;
      if (mode === 'signin') {
        session = await userSignIn({ email, password });
        message.success(t('signInSuccess'));
      } else {
        session = await userSignUp({ name, email, password, profile_image_url: '' });
        message.success(t('signUpSuccess'));
      }
      userStore.setUser(session);
      navigate('/', { replace: true });
    } catch (err) {
      message.error(err.message || t('somethingWentWrong'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    message.info(t('alreadyLoggedIn'));
    const timer = window.setTimeout(() => navigate('/', { replace: true }), 1200);
    return () => window.clearTimeout(timer);
  }, [isLoggedIn, navigate, t]);

  return (
    <div className={`${classes.bg} ${classes.text} ${classes.themeTransition} min-h-screen w-full flex flex-col font-primary`}>
      {/* 顶部导航栏 */}
      <div className={`h-16 border-b px-5 md:px-6 flex items-center justify-between flex-shrink-0 ${classes.bg} ${classes.border} ${classes.themeTransition}`}>
        <AppLogo name={WEBUI_NAME} />
        <NavHeader />
      </div>

      {/* 表单区域 */}
      <div className="flex-1 flex items-start justify-center px-4 pt-14">
        <div className="w-full sm:max-w-md">
          <Spin spinning={loading} delay={300}>
            <form className="flex flex-col" onSubmit={handleSubmit}>
              <div className="mb-1 text-center">
                <div className="text-2xl font-medium">
                  {mode === 'signin' ? t('Sign in') : t('Sign up')} {t('to')} {WEBUI_NAME}
                </div>
                {mode === 'signup' && (
                  <div className={`mt-1 text-xs font-medium ${classes.mutedText}`}>
                    ⓘ {t('localStorageNotice')}
                  </div>
                )}
              </div>

              <div className="flex flex-col mt-4 gap-6 mb-8">
                {/* 用户名（仅注册） */}
                {mode === 'signup' && (
                  <div>
                    <div className="text-sm font-medium text-left mb-2">{t('Name')}</div>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      type="text"
                      className={`px-5 py-3 rounded-2xl w-full text-sm outline-none border ${classes.input} ${classes.themeTransition}`}
                      autoComplete="name"
                      placeholder={t('Enter Your Full Name')}
                      required
                    />
                  </div>
                )}

                {/* 邮箱 */}
                <div>
                  <div className="text-sm font-medium text-left mb-2">{t('Email')}</div>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    className={`px-5 py-3 rounded-2xl w-full text-sm outline-none border ${classes.input} ${classes.themeTransition}`}
                    autoComplete="email"
                    placeholder={t('Enter Your Email')}
                    required
                  />
                </div>

                {/* 密码 */}
                <div>
                  <div className="text-sm font-medium text-left mb-2">{t('Password')}</div>
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('Enter Your Password')}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    classes={classes}
                  />
                </div>

                {/* 确认密码（仅注册） */}
                {mode === 'signup' && (
                  <div>
                    <div className="text-sm font-medium text-left mb-2">{t('Confirm Password')}</div>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t('Enter Your Password Again')}
                      autoComplete="new-password"
                      classes={classes}
                    />
                  </div>
                )}
              </div>

              <div className="mt-5">
                <button
                  className={`bg-gray-950 hover:bg-gray-900 w-full rounded-2xl text-white font-medium text-sm py-3 ${classes.themeTransition}`}
                  type="submit"
                >
                  {mode === 'signin' ? t('Sign in') : t('Create Account')}
                </button>

                <div className="mt-4 text-sm text-center">
                  {mode === 'signin' ? t('Dont have an account?') : t('Already have an account?')}
                  <button
                    className="font-medium underline ml-1"
                    type="button"
                    onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
                  >
                    {mode === 'signin' ? t('Sign up') : t('Sign in')}
                  </button>
                </div>

                {/* 默认账号提示：仅本地演示构建展示，真实后端部署下不提示弱口令 */}
                {mode === 'signin' && USE_LOCAL_DATA && (
                  <p className={`mt-5 text-center text-xs ${classes.mutedText}`}>
                    {t('demoCredentialsHint')}
                    <span className="font-mono ml-1">demo@example.com / demo123</span>
                  </p>
                )}
              </div>
            </form>
          </Spin>
        </div>
      </div>
    </div>
  );
};

export default LoginSignupForm;
