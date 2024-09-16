import React, { Suspense, lazy, useMemo } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks';

const ChatInterface = lazy(() => import('../components/ChatInterface'));
const NotFound = lazy(() => import('../pages/NotFound'));
const Login = lazy(() => import('../pages/LoginPage'));

const ProtectedRoute = ({ children }) => {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return isLoggedIn ? children : <Navigate to="/login" replace />;
};

const Layout = () => {
  const routes = useMemo(() => (
    <Routes>
      <Route path="/" element={<Navigate to="/new" replace />} />
      <Route path="/login" element={<Login />} />
      <Route
        path="/new"
        element={
          <ProtectedRoute>
            <ChatInterface />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  ), []);

  return (
      <Router>
        <Suspense fallback={<LoadingSpinner />}>
          {routes}
        </Suspense>
      </Router>
  );
};

export default Layout;