import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { api } from './utils/api';
import BottomNav from './components/BottomNav';
import MinePage from './pages/MinePage';

import FriendsPage from './pages/FriendsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import WithdrawPage from './pages/WithdrawPage';
import AdminPage from './pages/AdminPage';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initUser();
  }, []);

  async function initUser() {
    try {
      const tg = window.Telegram?.WebApp;
      let telegramData = {};

      if (tg?.initDataUnsafe?.user) {
        const tgUser = tg.initDataUnsafe.user;
        telegramData = {
          telegram_id: String(tgUser.id),
          username: tgUser.username || null,
          first_name: tgUser.first_name || 'Miner',
          last_name: tgUser.last_name || null,
          photo_url: tgUser.photo_url || null
        };

        // Check for referral from start param
        const startParam = tg.initDataUnsafe.start_param;
        if (startParam) {
          telegramData.referral_code = startParam;
        }

        // Expand webapp
        tg.expand();
        tg.setHeaderColor('#0a0a0f');
        tg.setBackgroundColor('#0a0a0f');
      } else {
        // Dev mode
        telegramData = {
          telegram_id: '123456789',
          username: 'dev_user',
          first_name: 'Developer',
          last_name: null,
          photo_url: null
        };
      }

      const data = await api.auth(telegramData);
      setUser(data.user);
    } catch (err) {
      console.error('Init error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function refreshUser() {
    if (!user) return;
    try {
      const data = await api.getUser(user.telegram_id);
      setUser(data.user);
    } catch (err) {
      console.error('Refresh user error:', err);
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <div className="loading-text">Connecting to pool...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="loading-container">
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div className="loading-text">Failed to connect. Please restart the app.</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes user={user} setUser={setUser} refreshUser={refreshUser} />
    </BrowserRouter>
  );
}

function AppRoutes({ user, setUser, refreshUser }) {
  const location = useLocation();
  const isAdmin = location.pathname === '/admin';

  return (
    <>
      <Routes>
        <Route path="/" element={<MinePage user={user} setUser={setUser} refreshUser={refreshUser} />} />
        <Route path="/friends" element={<FriendsPage user={user} />} />
        <Route path="/leaderboard" element={<LeaderboardPage user={user} />} />
        <Route path="/withdraw" element={<WithdrawPage user={user} refreshUser={refreshUser} />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      {!isAdmin && <BottomNav />}
    </>
  );
}

export default App;
