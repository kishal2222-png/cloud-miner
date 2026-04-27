import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import './FriendsPage.css';

function FriendsPage({ user }) {
  const [referralData, setReferralData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferrals();
  }, []);

  async function loadReferrals() {
    try {
      const data = await api.getReferrals(user.telegram_id);
      setReferralData(data);
    } catch (err) {
      console.error('Load referrals error:', err);
    }
    setLoading(false);
  }

  function getReferralLink() {
    return `https://t.me/your_bot?start=${referralData?.referral_code || user.referral_code}`;
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(getReferralLink());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = getReferralLink();
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleShare() {
    const text = `⛏ Join me on Cloud Miner and start mining crypto for free! Get +50 H/s bonus!\n\n${getReferralLink()}`;
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(getReferralLink())}&text=${encodeURIComponent('⛏ Join Cloud Miner and start mining crypto for free!')}`);
    } else {
      navigator.share?.({ text }) || handleCopy();
    }
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <div className="loading-text">Loading friends...</div>
      </div>
    );
  }

  const friends = referralData?.referrals || [];

  return (
    <div className="friends-page">
      <h1 className="page-title">👥 Friends</h1>

      {/* Stats */}
      <div className="friends-stats">
        <div className="friends-stat-card">
          <div className="friends-stat-value">{referralData?.referral_count || 0}</div>
          <div className="friends-stat-label">Friends Invited</div>
        </div>
        <div className="friends-stat-card">
          <div className="friends-stat-value">+{referralData?.total_bonus_hashrate || 0}</div>
          <div className="friends-stat-label">Bonus H/s</div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="referral-link-card">
        <div className="referral-link-title">Your Referral Link</div>
        <div className="referral-link-desc">Share this link and earn +50 H/s for each friend</div>
        <div className="referral-link-input">
          <div className="referral-link-url">{getReferralLink()}</div>
          <button className="referral-copy-btn" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <div className="referral-bonus-info">
          🎁 Each friend gives you +50 H/s mining speed permanently!
        </div>
      </div>

      {/* Share Button */}
      <button className="share-btn" onClick={handleShare} id="share-btn">
        📤 Share with Friends
      </button>

      {/* Friends List */}
      <div style={{ marginTop: 24 }}>
        <div className="friends-list-title">Invited Friends ({friends.length})</div>
        {friends.length === 0 ? (
          <div className="no-friends">
            <div className="no-friends-icon">👥</div>
            <div className="no-friends-text">No friends yet</div>
            <div className="no-friends-sub">Share your link to get started!</div>
          </div>
        ) : (
          friends.map((friend, idx) => (
            <div key={idx} className="friend-card">
              <div className="friend-info">
                <div className="friend-avatar">👤</div>
                <div>
                  <div className="friend-name">{friend.first_name || friend.username || 'User'}</div>
                  <div className="friend-date">{new Date(friend.joined_at).toLocaleDateString()}</div>
                </div>
              </div>
              <div className="friend-bonus">+50 H/s</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default FriendsPage;
