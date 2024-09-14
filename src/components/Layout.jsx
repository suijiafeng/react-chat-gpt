import React from "react";
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { ThemeProvider } from '../contexts/ThemeContext';
import { ModelProvider } from '../contexts/ModelContext';
import ChatInterface from '../components/ChatInterface'
import NotFound from '../pages/NotFound';
import Login from '../pages/LoginPage';

const Layout = () => {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  return (
    <ThemeProvider>
      <ModelProvider>
          <Router>
            <Routes>
              <Route path="/login" element={
                isLoggedIn ? <Navigate to="/" replace /> : <Login setIsLoggedIn={setIsLoggedIn} />
              } />
              <Route path="/" element={
                isLoggedIn ? <ChatInterface /> : <Navigate to="/login" replace />
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Router>
      </ModelProvider>
    </ThemeProvider>
  );
};
export default Layout;
