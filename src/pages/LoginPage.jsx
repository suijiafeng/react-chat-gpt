import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { message, Spin } from 'antd';
import { Eye, EyeOff } from 'lucide-react';
import NavHeader from '../components/NavHeader';
import AppLogo from '../components/AppLogo';
import { useLanguage, useAuth } from '../hooks';
import { useTheme } from '../contexts/ThemeContext';
import { userSignIn, userSignUp } from '../apis/auths';
import { userStore } from '../store';
import { consumeExpiredFlag } from '../utils/session';
import { reloadForCurrentUser } from '../store/llmConfig';
import { USE_LOCAL_DATA, DEMO_ACCOUNT, GUEST_ACCOUNT } from '../constants';

const MIN_PASSWORD_LENGTH = 6;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 字段级错误提示：校验失败留在对应输入框下方，而不是全部塞进一条全局 toast，
// 用户不必回想"哪一格填错了"
const FieldError = ({ message }) =>
  message ? (
    <div className="mt-2 text-sm text-red-500" role="alert">
      {message}
    </div>
  ) : null;

const errorBorder = 'border-red-500 focus:border-red-500';

// 带眼睛切换的密码输入框
const PasswordInput = ({ value, onChange, placeholder, autoComplete, classes, error }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        value={value}
        onChange={onChange}
        type={visible ? 'text' : 'password'}
        className={`px-5 py-3 pr-12 rounded-2xl w-full text-base outline-none border ${
          error ? errorBorder : classes.input
        } ${classes.themeTransition}`}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
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
  const location = useLocation();
  const { classes } = useTheme();
  const { t } = useLanguage();
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  // 不预填任何凭据：预填的演示账号会盖掉浏览器/密码管理器的自动填充，
  // 老用户每次登录都得先手动清空；演示账号改为下方提示文案告知即可
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const { isLoggedIn } = useAuth();

  // 被 ProtectedRoute 拦下来的原始去向：登录后送回用户本来想去的会话页，
  // 而不是一律丢回新会话，避免"点开一条旧对话 → 登录 → 又要自己找回去"
  const redirectTo = location.state?.from?.pathname || '/';

  // 输入即清除该字段的报错，避免用户改完还盯着一条已经不成立的红字
  const bind = (setter, field) => (e) => {
    setter(e.target.value);
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const switchMode = (next) => {
    setMode(next);
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setErrors({});
  };

  // 提交前本地校验：空值、邮箱格式、密码长度、两次密码一致。
  // 这些规则后端同样会校验（前端校验不是安全边界），本地先拦一道只是为了省掉一次
  // 往返，让用户马上看到问题出在哪一格。
  const validate = () => {
    const next = {};
    if (mode === 'signup' && !name.trim()) next.name = t('nameRequired');
    if (!email.trim()) next.email = t('emailRequired');
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = t('emailInvalid');
    if (!password) next.password = t('passwordRequired');
    else if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH) {
      next.password = t('passwordTooShort');
    }
    if (mode === 'signup' && confirmPassword !== password) {
      next.confirmPassword = t('passwordMismatch');
    }
    return next;
  };

  // 免登录一键体验：不走任何账号校验，直接置 demo_mode 标记进入演示模式。
  // resolveAuthState 会在刷新后依据该标记还原演示用户；退出登录时 userSignOut 会清掉标记。
  // 展示身份用 GUEST_ACCOUNT 而非 DEMO_ACCOUNT：这是与默认演示账号（demo@aichat.local）
  // 刻意分开的另一个身份，数据不互通，界面上也不该看着像同一个账号。
  const handleDemoLogin = () => {
    localStorage.setItem('demo_mode', 'true');
    userStore.setUser({
      email: GUEST_ACCOUNT.email,
      name: GUEST_ACCOUNT.name,
      profile_image_url: '',
    });
    reloadForCurrentUser(); // 切到演示账号的配置命名空间
    navigate('/new', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return; // 双击提交按钮不应发两次注册请求

    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      let session;
      if (mode === 'signin') {
        session = await userSignIn({ email: email.trim(), password });
        message.success(t('signInSuccess'));
      } else {
        session = await userSignUp({ name: name.trim(), email: email.trim(), password, profile_image_url: '' });
        message.success(t('signUpSuccess'));
      }
      userStore.setUser(session);
      reloadForCurrentUser(); // 切到该账号的配置命名空间
      navigate(redirectTo, { replace: true });
    } catch (err) {
      // err.message 已由 axios 拦截器统一换成服务端可读文案（如"该邮箱已被注册"）
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

  // 会话过期被动跳转过来时给出提示（标记由 handleSessionExpired 写入 sessionStorage，
  // 读完即删，刷新不会反复弹）
  useEffect(() => {
    if (consumeExpiredFlag()) {
      message.warning(t('sessionExpired'));
    }
  }, [t]);

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
            {/* noValidate：关掉浏览器原生校验气泡，改由下面的 validate() 统一出内联错误。
                两套并存时原生气泡会先拦下提交（文案还是浏览器语言），我们的提示反而看不到 */}
            <form className="flex flex-col" onSubmit={handleSubmit} noValidate>
              <div className="mb-1 text-center">
                <div className="text-3xl font-medium">
                  {mode === 'signin' ? t('Sign in') : t('Sign up')} {t('to')} {WEBUI_NAME}
                </div>
                {mode === 'signup' && (
                  <div className={`mt-1 text-sm font-medium ${classes.mutedText}`}>
                    ⓘ {t('localStorageNotice')}
                  </div>
                )}
              </div>

              <div className="flex flex-col mt-4 gap-6 mb-8">
                {/* 用户名（仅注册） */}
                {mode === 'signup' && (
                  <div>
                    <div className="text-base font-medium text-left mb-2">{t('Name')}</div>
                    <input
                      value={name}
                      onChange={bind(setName, 'name')}
                      type="text"
                      className={`px-5 py-3 rounded-2xl w-full text-base outline-none border ${
                        errors.name ? errorBorder : classes.input
                      } ${classes.themeTransition}`}
                      autoComplete="name"
                      placeholder={t('Enter Your Full Name')}
                      aria-invalid={Boolean(errors.name)}
                    />
                    <FieldError message={errors.name} />
                  </div>
                )}

                {/* 邮箱 */}
                <div>
                  <div className="text-base font-medium text-left mb-2">{t('Email')}</div>
                  <input
                    value={email}
                    onChange={bind(setEmail, 'email')}
                    type="email"
                    className={`px-5 py-3 rounded-2xl w-full text-base outline-none border ${
                      errors.email ? errorBorder : classes.input
                    } ${classes.themeTransition}`}
                    autoComplete="email"
                    placeholder={t('Enter Your Email')}
                    aria-invalid={Boolean(errors.email)}
                  />
                  <FieldError message={errors.email} />
                </div>

                {/* 密码 */}
                <div>
                  <div className="text-base font-medium text-left mb-2">{t('Password')}</div>
                  <PasswordInput
                    value={password}
                    onChange={bind(setPassword, 'password')}
                    placeholder={t('Enter Your Password')}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    classes={classes}
                    error={errors.password}
                  />
                  <FieldError message={errors.password} />
                  {mode === 'signup' && !errors.password && (
                    <div className={`mt-2 text-sm ${classes.mutedText}`}>{t('passwordHint')}</div>
                  )}
                </div>

                {/* 确认密码（仅注册） */}
                {mode === 'signup' && (
                  <div>
                    <div className="text-base font-medium text-left mb-2">{t('Confirm Password')}</div>
                    <PasswordInput
                      value={confirmPassword}
                      onChange={bind(setConfirmPassword, 'confirmPassword')}
                      placeholder={t('Enter Your Password Again')}
                      autoComplete="new-password"
                      classes={classes}
                      error={errors.confirmPassword}
                    />
                    <FieldError message={errors.confirmPassword} />
                  </div>
                )}
              </div>

              <div className="mt-5">
                {/* 提交中禁用按钮并换文案：请求在飞的时候按钮仍可点会打出重复注册请求，
                    而 Spin 有 300ms 延迟，快网络下用户根本看不到任何反馈 */}
                <button
                  className={`bg-gray-950 hover:bg-gray-900 w-full rounded-2xl text-white font-medium text-base py-3 disabled:opacity-60 disabled:cursor-not-allowed ${classes.themeTransition}`}
                  type="submit"
                  disabled={loading}
                >
                  {loading
                    ? t('submitting')
                    : mode === 'signin'
                      ? t('Sign in')
                      : t('Create Account')}
                </button>

                {/* 免登录体验：最低门槛的上手入口，点一下直接进入演示模式聊天 */}
                {mode === 'signin' && (
                  <button
                    className={`mt-3 w-full rounded-2xl border font-medium text-base py-3 ${classes.input} ${classes.themeTransition} hover:opacity-80`}
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={loading}
                  >
                    {t('tryDemo')}
                  </button>
                )}

                <div className="mt-4 text-base text-center">
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
                  <p className={`mt-5 text-center text-sm ${classes.mutedText}`}>
                    {t('demoCredentialsHint')}
                    <span className="font-mono ml-1">
                      {DEMO_ACCOUNT.email} / {DEMO_ACCOUNT.password}
                    </span>
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
