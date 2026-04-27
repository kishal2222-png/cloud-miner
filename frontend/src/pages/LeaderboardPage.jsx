import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import './LeaderboardPage.css';

function LeaderboardPage({ user }) {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    try {
      const data = await api.getLeaderboard();
      setLeaders(data.leaders || []);
    } catch (err) {
      console.error('Load leaderboard error:', err);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <div className="loading-text">Loading leaderboard...</div>
      </div>
    );
  }

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  return (
    <div className="leaderboard-page">
      <h1 className="page-title">🏆 Leaderboard</h1>

      {top3.length >= 3 && (
        <div className="podium">
          {podiumOrder.map((l, idx) => {
            const medals = ['🥈', '🥇', '🥉'];
            return (
              <div key={idx} className="podium-item">
                <div className="podium-avatar">
                  {l.first_name ? l.first_name[0] : '?'}
                </div>
                <div className="podium-name">{l.first_name || 'User'}</div>
                <div className="podium-value">{(l.total_mined_ton || 0).toFixed(5)} TON</div>
                <div className="podium-bar">{medals[idx]}</div>
              </div>
            );
          })}
        </div>
      )}

      <div className="leaderboard-list">
        {rest.map((l, idx) => (
          <div key={idx} className={`leader-card ${l.telegram_id === user.telegram_id ? 'is-me' : ''}`}>
            <div className="leader-rank">#{idx + 4}</div>
            <div className="leader-avatar">{l.first_name ? l.first_name[0] : '?'}</div>
            <div className="leader-info">
              <div className="leader-name">{l.first_name || l.username || 'User'}</div>
              <div className="leader-hashrate">{l.hashrate} H/s</div>
            </div>
            <div className="leader-value">{(l.total_mined_ton || 0).toFixed(5)} TON</div>
          </div>
        ))}
        {leaders.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            No miners yet. Be the first!
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaderboardPage;
