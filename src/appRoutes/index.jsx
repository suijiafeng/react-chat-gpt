import { Suspense, lazy } from 'react';
import { HashRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks';
import { APP_NAME } from '../constants';

const ChatInterface = lazy(() => import('../components/ChatInterface'));
const NotFound = lazy(() => import('../pages/NotFound'));
const Login = lazy(() => import('../pages/LoginPage'));

const ProtectedRoute = ({ children }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

const Layout = () => {
  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Navigate to="/new" replace />} />
          <Route path="/login" element={<Login WEBUI_NAME={APP_NAME} />} />
          <Route
            path="/new"
            element={
              <ProtectedRoute>
                <ChatInterface />
              </ProtectedRoute>
            }
          />
          <Route
            path="/c/:chatId"
            element={
              <ProtectedRoute>
                <ChatInterface />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
};

export default Layout;
