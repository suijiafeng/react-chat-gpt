import React, { Suspense, lazy,useMemo } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ModelProvider } from '../contexts/ModelContext';
import LoadingSpinner from './LoadingSpinner'
import { useAuth } from '../hooks'

const ChatInterface = lazy(() => import('./ChatInterface'));
const NotFound = lazy(() => import('../pages/NotFound'));
const Login = lazy(() => import('../pages/LoginPage'));

const Layout = () => {
  const ProtectedRoute = ({ children }) => {
    const { isLoggedIn, isLoading } = useAuth();
    if (isLoading) {
      return <LoadingSpinner />;
    }

    return isLoggedIn ? children : <Navigate to={'/login'} replace />;
  };

  return (
    <ThemeProvider>
      <ModelProvider>
        <Router>
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path={'/login'} element={<Login />} />
              <Route
                path={'/'}
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
      </ModelProvider>
    </ThemeProvider>
  );
};
export default Layout;
