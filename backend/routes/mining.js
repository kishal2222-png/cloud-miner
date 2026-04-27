const express = require('express');
const router = express.Router();
const { getOne, getAll } = require('../database');

const TON_RATE = 0.00001; // TON per 1M H/s per minute

router.get('/status/:telegramId', (req, res) => {
  try {
    const user = getOne('SELECT * FROM users WHERE telegram_id = ?', [req.params.telegramId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const activeMiners = getAll(
      `SELECT * FROM miners WHERE user_id = ? AND is_active = 1`, [user.id]
    );
    const bonusHashrate = activeMiners.reduce((s, m) => s + m.hashrate, 0);
    const totalHashrate = user.hashrate + bonusHashrate;

    // Calculate pending mined TON since last collect
    let pendingMined = 0;
    if (user.mining_started_at) {
      const startTime = new Date(user.mining_started_at + 'Z').getTime();
      const now = Date.now();
      const minutes = (now - startTime) / 60000;
      pendingMined = (totalHashrate / 1000000) * TON_RATE * Math.max(0, minutes);
    }

    const tonPerSecond = (totalHashrate / 1000000) * TON_RATE / 60;

    // Income projections
    const tonPerDay = tonPerSecond * 86400;
    const tonPerMonth = tonPerDay * 30;
    const tonPer3Months = tonPerDay * 90;

    res.json({
      is_mining: true,
      base_hashrate: user.hashrate,
      bonus_hashrate: bonusHashrate,
      total_hashrate: totalHashrate,
      mining_started_at: user.mining_started_at,
      pending_mined: pendingMined,
      balance_ton: user.balance_ton || 0,
      ton_per_second: tonPerSecond,
      income_1d: tonPerDay,
      income_1m: tonPerMonth,
      income_3m: tonPer3Months
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/mining/collect — collect pending mined TON into balance
router.post('/collect', (req, res) => {
  try {
    const { telegram_id } = req.body;
    const { getOne, runQuery } = require('../database');

    const user = getOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegram_id)]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const activeMiners = getAll(
      `SELECT * FROM miners WHERE user_id = ? AND is_active = 1`, [user.id]
    );
    const bonusHashrate = activeMiners.reduce((s, m) => s + m.hashrate, 0);
    const totalHashrate = user.hashrate + bonusHashrate;

    // Calculate mined since last collect
    let mined = 0;
    if (user.mining_started_at) {
      const startTime = new Date(user.mining_started_at + 'Z').getTime();
      const now = Date.now();
      const minutes = (now - startTime) / 60000;
      mined = (totalHashrate / 1000000) * TON_RATE * Math.max(0, minutes);
    }

    if (mined <= 0) {
      return res.json({ message: 'Nothing to collect', collected: 0, balance_ton: user.balance_ton });
    }

    // Add to balance and reset mining timer
    runQuery(
      `UPDATE users SET balance_ton = balance_ton + ?, total_mined_ton = total_mined_ton + ?, mining_started_at = datetime('now'), last_active_at = datetime('now') WHERE id = ?`,
      [mined, mined, user.id]
    );

    // Log transaction
    runQuery(
      `INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'collect', ?, ?)`,
      [user.id, mined, `Collected ${mined.toFixed(9)} TON`]
    );

    const updated = getOne('SELECT * FROM users WHERE id = ?', [user.id]);

    res.json({
      message: 'TON collected!',
      collected: mined,
      balance_ton: updated.balance_ton,
      total_mined_ton: updated.total_mined_ton
    });
  } catch (err) {
    console.error('Collect error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reinvestment plans — TON → permanent hashrate
const REINVEST_PLANS = [
  { id: 'r1', name: 'Micro Boost', ton: 0.1, hashrate: 200, label: '+200 H/s' },
  { id: 'r2', name: 'Small Boost', ton: 0.5, hashrate: 1200, label: '+1.2K H/s' },
  { id: 'r3', name: 'Medium Boost', ton: 1, hashrate: 3000, label: '+3K H/s' },
  { id: 'r4', name: 'Large Boost', ton: 5, hashrate: 20000, label: '+20K H/s' },
  { id: 'r5', name: 'Mega Boost', ton: 10, hashrate: 50000, label: '+50K H/s' },
  { id: 'r6', name: 'Ultra Boost', ton: 50, hashrate: 300000, label: '+300K H/s' },
];

router.get('/reinvest/plans', (req, res) => {
  res.json({ plans: REINVEST_PLANS });
});

router.post('/reinvest', (req, res) => {
  try {
    const { telegram_id, plan_id } = req.body;
    const { runQuery } = require('../database');

    const plan = REINVEST_PLANS.find(p => p.id === plan_id);
    if (!plan) return res.status(400).json({ error: 'Invalid reinvestment plan' });

    const user = getOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegram_id)]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if ((user.balance_ton || 0) < plan.ton) {
      return res.status(400).json({ error: `Insufficient balance. Need ${plan.ton} TON` });
    }

    // Deduct TON and add permanent base hashrate
    runQuery(
      `UPDATE users SET balance_ton = balance_ton - ?, hashrate = hashrate + ?, last_active_at = datetime('now') WHERE id = ?`,
      [plan.ton, plan.hashrate, user.id]
    );

    runQuery(
      `INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'reinvest', ?, ?)`,
      [user.id, -plan.ton, `Reinvested ${plan.ton} TON → ${plan.label} permanent`]
    );

    const updated = getOne('SELECT * FROM users WHERE id = ?', [user.id]);

    res.json({
      message: `${plan.name} activated! +${plan.hashrate} H/s permanently`,
      balance_ton: updated.balance_ton,
      new_hashrate: updated.hashrate
    });
  } catch (err) {
    console.error('Reinvest error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
