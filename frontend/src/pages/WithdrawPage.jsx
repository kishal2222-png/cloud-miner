import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import './WithdrawPage.css';

const MIN_WITHDRAWAL = 0.5;

function WithdrawPage({ user, refreshUser }) {
  const [tab, setTab] = useState('reinvest'); // 'reinvest' | 'withdraw'
  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);
  const [reinvestPlans, setReinvestPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    loadWithdrawals();
    loadReinvestPlans();
  }, []);

  async function loadWithdrawals() {
    try {
      const data = await api.getWithdrawals(user.telegram_id);
      setWithdrawals(data.withdrawals || []);
    } catch (err) { console.error(err); }
  }

  async function loadReinvestPlans() {
    try {
      const data = await api.getReinvestPlans();
      setReinvestPlans(data.plans || []);
    } catch (err) { console.error(err); }
  }

  async function handleWithdraw() {
    if (!amount || !wallet) return;
    setLoading(true);
    setStatus(null);
    try {
      await api.createWithdrawal({
        telegram_id: user.telegram_id,
        amount: parseFloat(amount),
        wallet_address: wallet
      });
      setStatus({ type: 'success', msg: 'Withdrawal request created!' });
      setAmount(''); setWallet('');
      await refreshUser();
      await loadWithdrawals();
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    }
    setLoading(false);
  }

  async function handleReinvest(plan) {
    if ((user.balance_ton || 0) < plan.ton) {
      setStatus({ type: 'error', msg: `Need ${plan.ton} TON. Keep mining!` });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const result = await api.reinvest(user.telegram_id, plan.id);
      setStatus({ type: 'success', msg: result.message });
      await refreshUser();
      setTimeout(() => setStatus(null), 4000);
    } catch (err) {
      setStatus({ type: 'error', msg: err.message });
    }
    setLoading(false);
  }

  const balance = user.balance_ton || 0;

  return (
    <div className="withdraw-page">
      {/* Balance Card */}
      <div className="ton-balance-card">
        <div className="ton-balance-header">
          <div className="ton-balance-icon">💎</div>
          <div>
            <div className="ton-balance-label">Available Balance</div>
            <div className="ton-balance-value">{balance.toFixed(5)} TON</div>
          </div>
        </div>
        <div className="ton-balance-hashrate">
          ⚡ {user.hashrate || 100} H/s base hashrate
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="withdraw-tabs">
        <button
          className={`withdraw-tab ${tab === 'reinvest' ? 'active' : ''}`}
          onClick={() => { setTab('reinvest'); setStatus(null); }}
        >
          🔄 Reinvest
        </button>
        <button
          className={`withdraw-tab ${tab === 'withdraw' ? 'active' : ''}`}
          onClick={() => { setTab('withdraw'); setStatus(null); }}
        >
          💸 Withdraw
        </button>
      </div>

      {/* Status Message */}
      {status && (
        <div className={`status-msg ${status.type}`}>
          {status.type === 'success' ? '✅' : '❌'} {status.msg}
        </div>
      )}

      {/* Reinvest Tab */}
      {tab === 'reinvest' && (
        <div className="reinvest-section">
          <div className="reinvest-header">
            <h2 className="reinvest-title">🔄 Reinvest TON</h2>
            <p className="reinvest-desc">Convert earned TON into permanent hashrate boost. Higher speed = more TON/hour!</p>
          </div>

          <div className="reinvest-grid">
            {reinvestPlans.map(plan => {
              const canAfford = balance >= plan.ton;
              return (
                <div key={plan.id} className={`reinvest-card ${!canAfford ? 'disabled' : ''}`}>
                  <div className="reinvest-card-top">
                    <div className="reinvest-name">{plan.name}</div>
                    <div className="reinvest-hashrate">{plan.label}</div>
                  </div>
                  <div className="reinvest-card-bottom">
                    <div className="reinvest-price">💎 {plan.ton} TON</div>
                    <button
                      className="reinvest-btn"
                      onClick={() => handleReinvest(plan)}
                      disabled={loading || !canAfford}
                    >
                      {canAfford ? 'Reinvest' : 'Not enough'}
                    </button>
                  </div>
                  <div className="reinvest-ratio">
                    1 TON = {Math.round(plan.hashrate / plan.ton)} H/s
                  </div>
                </div>
              );
            })}
          </div>

          <div className="reinvest-tip">
            💡 Reinvesting increases your base hashrate permanently — mine faster forever!
          </div>
        </div>
      )}

      {/* Withdraw Tab */}
      {tab === 'withdraw' && (
        <div className="withdraw-form">
          <div className="withdraw-form-title">💸 Withdraw TON</div>

          <div className="form-group">
            <label className="form-label">Amount</label>
            <input
              className="input"
              type="number"
              step="any"
              placeholder={`Min: ${MIN_WITHDRAWAL} TON`}
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
              <span>Available: {balance.toFixed(5)} TON</span>
              <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setAmount(String(balance))}>MAX</span>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">TON Wallet Address</label>
            <input
              className="input"
              type="text"
              placeholder="UQ... or EQ..."
              value={wallet}
              onChange={e => setWallet(e.target.value)}
            />
          </div>

          <button className="withdraw-btn" onClick={handleWithdraw} disabled={loading || !amount || !wallet}>
            {loading ? 'Processing...' : 'Withdraw TON'}
          </button>

          <div className="withdraw-info">Zero commission • Processing 1-24h</div>
        </div>
      )}

      {/* History */}
      {withdrawals.length > 0 && (
        <div className="withdraw-history">
          <div className="withdraw-history-title">History</div>
          {withdrawals.map(w => (
            <div key={w.id} className="withdrawal-item">
              <div>
                <div className="withdrawal-coin">💎 TON</div>
                <div className="withdrawal-date">{new Date(w.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="withdrawal-amount">{w.amount.toFixed(5)}</div>
                <span className={`withdrawal-status ${w.status}`}>{w.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default WithdrawPage;
