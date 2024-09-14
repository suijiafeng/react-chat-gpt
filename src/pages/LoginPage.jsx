import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import Spinner from '../components/Spinner';
import { 
  WEBUI_BASE_URL, 
} from '../constants';
// import { 
//   useUser, 
//   useConfig, 
//   useSocket,
// } from '../hooks';
// import { 
//   getSessionUser, 
//   userSignIn, 
//   userSignUp, 
//   getBackendConfig 
// } from '../apis';
// import { generateInitialsImage } from '../utils';

const Login = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  // const [user, setUser] = useUser();
  // const [user, setUser] = useState(false);
  // const [config, setConfig] = useConfig();
  // const socket = useSocket();


  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const setSessionUser = async (sessionUser) => {
    if (sessionUser) {
      console.log(sessionUser);
      toast.success(t("You're now logged in."));
      if (sessionUser.token) {
        localStorage.setItem('token', sessionUser.token);
      }

      // socket.emit('user-join', { auth: { token: sessionUser.token } });
      // await setUser(sessionUser);
      // await setConfig(await getBackendConfig());
      navigate('/');
    }
  };

  const signInHandler = async () => {
    try {
      // const sessionUser = await userSignIn(email, password);
      // await setSessionUser(sessionUser);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const signUpHandler = async () => {
    try {
      // const sessionUser = await userSignUp(name, email, password, generateInitialsImage(name));
      // await setSessionUser(sessionUser);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    if (mode === 'signin') {
      await signInHandler();
    } else {
      await signUpHandler();
    }
  };

  const checkOauthCallback = async () => {
    const hash = window.location.hash.substring(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const token = params.get('token');
    if (!token) return;

    try {
      // const sessionUser = await getSessionUser(token);
      // if (sessionUser) {
      //   localStorage.setItem('token', token);
      //   await setSessionUser(sessionUser);
      // }
    } catch (error) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    // const init = async () => {
    //   if (user !== undefined) {
    //     navigate('/');
    //     return;
    //   }
    //   // await checkOauthCallback();
    //   setLoaded(true);
    //   if ((config?.features.auth_trusted_header ?? false) || config?.features.auth === false) {
    //     await signInHandler();
    //   }
    // };

    // init();
  }, []);

  if (!loaded) {
    return null;
  }

  return (
    <>
      <div className="fixed m-10 z-50">
        <div className="flex space-x-2">
          <div className="self-center">
            <img
              crossOrigin="anonymous"
              src={`${WEBUI_BASE_URL}/static/favicon.png`}
              className="w-8 rounded-full"
              alt="logo"
            />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-950 min-h-screen w-full flex justify-center font-primary">
        <div className="w-full sm:max-w-md px-10 min-h-screen flex flex-col text-center">
          {((config?.features.auth_trusted_header ?? false) || config?.features.auth === false) ? (
            <div className="my-auto pb-10 w-full">
              <div className="flex items-center justify-center gap-3 text-xl sm:text-2xl text-center font-semibold dark:text-gray-200">
                <div>
                  {t('Signing in')}
                  {t('to')}
                </div>
                <div>
                  <Spinner />
                </div>
              </div>
            </div>
          ) : (
            <div className="my-auto pb-10 w-full dark:text-gray-100">
              <form className="flex flex-col justify-center" onSubmit={submitHandler}>
                {/* Form content */}
              </form>
              {/* OAuth providers */}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Login;