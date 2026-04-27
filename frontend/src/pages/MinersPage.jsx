import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import './MinersPage.css';

function MinersPage({ user, refreshUser }) {
  const [plans, setPlans] = useState([]);
  const [activeMiners, setActiveMiners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [plansData, minersData] = await Promise.all([
        api.getPlans(),
        api.getMiners(user.telegram_id)
      ]);
      setPlans(plansData.plans || []);
      setActiveMiners((minersData.miners || []).filter(m => m.is_active));
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  async function handleBuyPlan(plan) {
    const balance = user.balance_ton || 0;
    if (balance < plan.price_ton) {
      alert(`Insufficient balance!\nNeed ${plan.price_ton} TON, have ${balance.toFixed(5)} TON`);
      return;
    }
    if (!window.confirm(`Buy ${plan.name}?\n\n+${formatHashrate(plan.hashrate)} H/s permanently\nCost: ${plan.price_ton} TON`)) return;

    try {
      const result = await api.activateMiner(user.telegram_id, plan.id);
      await loadData();
      await refreshUser();
      alert(`✅ ${plan.name} activated permanently!`);
    } catch (err) { alert('Error: ' + err.message); }
  }

  function formatHashrate(h) {
    if (h >= 1000000) return (h / 1000000).toFixed(1) + 'M';
    if (h >= 1000) return (h / 1000).toFixed(1) + 'K';
    return h.toString();
  }

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><div className="loading-text">Loading miners...</div></div>;
  }

  return (
    <div className="miners-page">
      <h1 className="page-title">🖥 Pool Miners</h1>
      <p className="miners-subtitle">Boost your mining speed permanently! Pay with mined TON.</p>

      <div className="miner-balance-bar">
        <span>💎 Your balance:</span>
        <span className="miner-balance-value">{(user.balance_ton || 0).toFixed(5)} TON</span>
      </div>

      {/* Active Miners */}
      <div className="active-miners-section">
        <div className="section-title">
          Active Miners
          {activeMiners.length > 0 && <span className="section-count">{activeMiners.length}</span>}
        </div>

        {activeMiners.length === 0 ? (
          <div className="no-active-miners">No active miners yet. Purchase one below!</div>
        ) : (
          activeMiners.map(miner => (
            <div key={miner.id} className="active-miner-card">
              <div className="active-miner-header">
                <span className="active-miner-name">{miner.name}</span>
                <span className="active-miner-badge">♾ Forever</span>
              </div>
              <div className="active-miner-stats">
                <div className="active-miner-stat">
                  <div className="active-miner-stat-value">{formatHashrate(miner.hashrate)}</div>
                  <div className="active-miner-stat-label">H/s</div>
                </div>
                <div className="active-miner-stat">
                  <div className="active-miner-stat-value">∞</div>
                  <div className="active-miner-stat-label">Duration</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Plans */}
      <div className="section-title">Available Plans</div>
      <div className="plans-grid">
        {plans.map((plan, idx) => (
          <div key={plan.id} className={`plan-card ${idx === 2 ? 'popular' : ''}`}>
            <div className="plan-header">
              <span className="plan-name">{plan.name}</span>
              <span className="plan-price">💎 {plan.price_ton} TON</span>
            </div>
            <div className="plan-details">
              <div className="plan-detail">
                <span className="plan-detail-value">{formatHashrate(plan.hashrate)} H/s</span>
                <span className="plan-detail-label">Speed Boost</span>
              </div>
              <div className="plan-detail">
                <span className="plan-detail-value">♾ Forever</span>
                <span className="plan-detail-label">Duration</span>
              </div>
            </div>
            <button
              className="plan-buy-btn"
              onClick={() => handleBuyPlan(plan)}
              disabled={(user.balance_ton || 0) < plan.price_ton}
            >
              {(user.balance_ton || 0) >= plan.price_ton ? 'Buy with TON' : `Need ${plan.price_ton} TON`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MinersPage;
