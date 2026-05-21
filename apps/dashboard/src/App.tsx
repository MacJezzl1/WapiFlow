import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/useAuthStore';
import { useChatStore } from './store/useChatStore';
import InboxContainer from './components/Inbox/InboxContainer';
import Login from './components/Auth/Login';
import './styles/globals.css';

function App() {
  const { user, accessToken } = useAuthStore();
  const { connect } = useChatStore();

  useEffect(() => {
    if (accessToken) {
      connect(accessToken);
    }
  }, [accessToken, connect]);

  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/inbox" />} />
          <Route 
            path="/inbox" 
            element={user ? <InboxContainer /> : <Navigate to="/login" />} 
          />
          <Route path="*" element={<Navigate to="/inbox" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
