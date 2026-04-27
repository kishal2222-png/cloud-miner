import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import './MinePage.css';

function MinePage({ user, setUser, refreshUser }) {
  const [miningStatus, setMiningStatus] = useState(null);
  const [displayBalance, setDisplayBalance] = useState(0);
  const [tonPerSecond, setTonPerSecond] = useState(0);
  const [income, setIncome] = useState({ d1: 0, m1: 0, m3: 0 });
  const [collecting, setCollecting] = useState(false);
  const [collectResult, setCollectResult] = useState(null);
  const balanceRef = useRef(0);

  // Slider state
  const [sliderValue, setSliderValue] = useState(100);
  const [tonPerHs, setTonPerHs] = useState(0.0005);
  const [buying, setBuying] = useState(false);
  const [buyResult, setBuyResult] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.getMiningStatus(user.telegram_id);
      setMiningStatus(data);
      const total = data.pending_mined || 0;
      balanceRef.current = total;
      setDisplayBalance(total);
      setTonPerSecond(data.ton_per_second || 0);
      setIncome({ d1: data.income_1d || 0, m1: data.income_1m || 0, m3: data.income_3m || 0 });
    } catch (err) { console.error(err); }
  }, [user.telegram_id]);

  useEffect(() => {
    fetchStatus();
    api.getHashratePrice().then(d => setTonPerHs(d.ton_per_hs)).catch(() => {});
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Real-time ticker
  useEffect(() => {
    if (tonPerSecond <= 0) return;
    const increment = tonPerSecond / 10;
    const ticker = setInterval(() => {
      balanceRef.current += increment;
      setDisplayBalance(balanceRef.current);
    }, 100);
    return () => clearInterval(ticker);
  }, [tonPerSecond]);

  async function handleCollect() {
    setCollecting(true);
    setCollectResult(null);
    try {
      const result = await api.collectMining(user.telegram_id);
      setCollectResult({ collected: result.collected, balance: result.balance_ton });
      balanceRef.current = 0;
      setDisplayBalance(0);
      await refreshUser();
      setTimeout(() => setCollectResult(null), 3000);
    } catch (err) { console.error(err); }
    setCollecting(false);
  }

  async function handleBuyHashrate() {
    const cost = Math.round(sliderValue * tonPerHs * 100000) / 100000;
    if ((user.balance_ton || 0) < cost) {
      setBuyResult({ type: 'error', msg: `Not enough TON. Need ${cost} TON` });
      setTimeout(() => setBuyResult(null), 3000);
      return;
    }
    setBuying(true);
    setBuyResult(null);
    try {
      const result = await api.buyHashrate(user.telegram_id, sliderValue);
      setBuyResult({ type: 'success', msg: `✅ +${sliderValue} H/s purchased for ${cost} TON!` });
      await refreshUser();
      await fetchStatus();
      setTimeout(() => setBuyResult(null), 4000);
    } catch (err) {
      setBuyResult({ type: 'error', msg: err.message });
      setTimeout(() => setBuyResult(null), 3000);
    }
    setBuying(false);
  }

  function formatBalance(val) {
    if (val === 0) return '0.000000000';
    if (val < 0.000001) return val.toFixed(12);
    if (val < 0.001) return val.toFixed(9);
    if (val < 1) return val.toFixed(7);
    if (val < 100) return val.toFixed(5);
    return val.toFixed(3);
  }

  function formatIncome(val) {
    if (val === 0) return '0.00000';
    if (val < 0.001) return val.toFixed(8);
    if (val < 1) return val.toFixed(5);
    return val.toFixed(3);
  }

  function formatHashrate(h) {
    if (h >= 1000000) return (h / 1000000).toFixed(1) + 'M';
    if (h >= 1000) return (h / 1000).toFixed(1) + 'K';
    return h.toString();
  }

  function formatTonPerHour(tps) {
    const perHour = tps * 3600;
    if (perHour < 0.001) return perHour.toFixed(8);
    if (perHour < 1) return perHour.toFixed(6);
    return perHour.toFixed(4);
  }

  const totalHashrate = miningStatus?.total_hashrate || user.total_hashrate || 100;
  const baseHashrate = miningStatus?.base_hashrate || user.hashrate || 100;
  const bonusHashrate = miningStatus?.bonus_hashrate || 0;
  const speedPercent = Math.min((totalHashrate / 1000000) * 100, 100);
  const walletBalance = miningStatus?.balance_ton || user.balance_ton || 0;
  const sliderCost = Math.round(sliderValue * tonPerHs * 100000) / 100000;
  const canAfford = walletBalance >= sliderCost;

  return (
    <div className="mine-page">
      {/* Header */}
      <div className="mine-header">
        <div className="mine-user">
          <div className="mine-avatar">
            {user.first_name ? user.first_name[0].toUpperCase() : '?'}
          </div>
          <div className="mine-user-info">
            <span className="mine-user-name">{user.first_name || 'Miner'}</span>
            <span className="mine-user-level">Level {user.level || 1}</span>
          </div>
        </div>
        <div className="mine-hashrate-badge">
          <div className="mine-hashrate-value">{formatHashrate(totalHashrate)} H/s</div>
          <div className="mine-hashrate-label">Hash Rate</div>
        </div>
      </div>

      {/* Wallet Balance */}
      <div className="wallet-balance-bar">
        <span className="wallet-balance-label">💎 Wallet</span>
        <span className="wallet-balance-value">{formatBalance(walletBalance)} TON</span>
      </div>

      {/* Mining Dashboard */}
      <div className="mining-dashboard mining-active" id="mining-dashboard">
        <div className="mining-particles">
          <div className="particle" /><div className="particle" /><div className="particle" />
          <div className="particle" /><div className="particle" /><div className="particle" />
        </div>

        <div className="mining-visual">
          <div className="mining-orb-container">
            <div className="mining-orb-rings" />
            <div className="mining-orb">
              <span className="mining-coin-icon">💎</span>
              <span className="mining-coin-name">TON</span>
            </div>
          </div>

          <div className="mining-balance">
            <div className="mining-balance-label">Uncollected</div>
            <span className="mining-balance-value">{formatBalance(displayBalance)}</span>
            <span className="mining-balance-coin">TON</span>
          </div>
        </div>

        <div className="mining-status-text">
          <span className="mining-status-dot" />
          Pool mining active
        </div>

        <button
          className="collect-btn"
          onClick={handleCollect}
          disabled={collecting || displayBalance < 0.000000001}
        >
          {collecting ? '⏳ Collecting...' : '💰 Collect TON'}
        </button>

        {collectResult && (
          <div className="collect-result">
            ✅ Collected {formatBalance(collectResult.collected)} TON
          </div>
        )}

        {/* Income Projections — inside mining card */}
        <div className="income-section-inline">
          <div className="income-title">📈 Income Projection</div>
          <div className="income-grid">
            <div className="income-card">
              <div className="income-period">1 Day</div>
              <div className="income-value">{formatIncome(income.d1)}</div>
              <div className="income-unit">TON</div>
            </div>
            <div className="income-card">
              <div className="income-period">1 Month</div>
              <div className="income-value">{formatIncome(income.m1)}</div>
              <div className="income-unit">TON</div>
            </div>
            <div className="income-card income-card-accent">
              <div className="income-period">3 Months</div>
              <div className="income-value">{formatIncome(income.m3)}</div>
              <div className="income-unit">TON</div>
            </div>
          </div>
        </div>
      </div>

      {/* Hashrate Slider — Buy Power */}
      <div className="slider-section">
        <div className="slider-header">
          <span className="slider-title">⚡ Buy Mining Power</span>
          <span className="slider-subtitle">Permanent boost • 1 TON = {Math.round(1 / tonPerHs)} H/s</span>
        </div>

        <div className="slider-display">
          <div className="slider-hs-value">+{formatHashrate(sliderValue)} H/s</div>
          <div className="slider-cost">💎 {sliderCost.toFixed(5)} TON</div>
        </div>

        <div className="slider-container">
          <input
            type="range"
            className="hashrate-slider"
            min="100"
            max="10000"
            step="100"
            value={sliderValue}
            onChange={e => setSliderValue(parseInt(e.target.value))}
          />
          <div className="slider-labels">
            <span>100 H/s</span>
            <span>5K H/s</span>
            <span>10K H/s</span>
          </div>
        </div>

        <button
          className="buy-hashrate-btn"
          onClick={handleBuyHashrate}
          disabled={buying || !canAfford}
        >
          {buying ? '⏳ Processing...' : canAfford ? `Buy +${formatHashrate(sliderValue)} H/s for ${sliderCost.toFixed(5)} TON` : `Need ${sliderCost.toFixed(5)} TON`}
        </button>

        {buyResult && (
          <div className={`buy-result ${buyResult.type}`}>{buyResult.msg}</div>
        )}
      </div>
    </div>
  );
}

export default MinePage;
