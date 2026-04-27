const express = require('express');
const router = express.Router();
const { getOne, getAll, runQuery } = require('../database');

const TON_RATE = 0.00001;

router.get('/status/:telegramId', async (req, res) => {
  try {
    const user = await getOne('SELECT * FROM users WHERE telegram_id = ?', [req.params.telegramId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const activeMiners = await getAll(
      `SELECT * FROM miners WHERE user_id = ? AND is_active = 1`, [user.id]
    );
    const bonusHashrate = activeMiners.reduce((s, m) => s + m.hashrate, 0);
    const totalHashrate = user.hashrate + bonusHashrate;

    let pendingMined = 0;
    if (user.mining_started_at) {
      const startTime = new Date(user.mining_started_at).getTime();
      const now = Date.now();
      const minutes = (now - startTime) / 60000;
      pendingMined = (totalHashrate / 1000000) * TON_RATE * Math.max(0, minutes);
    }

    const tonPerSecond = (totalHashrate / 1000000) * TON_RATE / 60;
    const tonPerDay = tonPerSecond * 86400;

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
      income_1m: tonPerDay * 30,
      income_3m: tonPerDay * 90
    });
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/collect', async (req, res) => {
  try {
    const { telegram_id } = req.body;
    const user = await getOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegram_id)]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const activeMiners = await getAll(
      `SELECT * FROM miners WHERE user_id = ? AND is_active = 1`, [user.id]
    );
    const bonusHashrate = activeMiners.reduce((s, m) => s + m.hashrate, 0);
    const totalHashrate = user.hashrate + bonusHashrate;

    let mined = 0;
    if (user.mining_started_at) {
      const startTime = new Date(user.mining_started_at).getTime();
      const now = Date.now();
      const minutes = (now - startTime) / 60000;
      mined = (totalHashrate / 1000000) * TON_RATE * Math.max(0, minutes);
    }

    if (mined <= 0) {
      return res.json({ message: 'Nothing to collect', collected: 0, balance_ton: user.balance_ton });
    }

    await runQuery(
      `UPDATE users SET balance_ton = balance_ton + ?, total_mined_ton = total_mined_ton + ?, mining_started_at = NOW(), last_active_at = NOW() WHERE id = ?`,
      [mined, mined, user.id]
    );
    await runQuery(
      `INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'collect', ?, ?)`,
      [user.id, mined, `Collected ${mined.toFixed(9)} TON`]
    );

    const updated = await getOne('SELECT * FROM users WHERE id = ?', [user.id]);

    res.json({ message: 'TON collected!', collected: mined, balance_ton: updated.balance_ton, total_mined_ton: updated.total_mined_ton });
  } catch (err) {
    console.error('Collect error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Reinvestment plans
const REINVEST_PLANS = [
  { id: 'r1', name: 'Micro Boost', ton: 0.1, hashrate: 200, label: '+200 H/s' },
  { id: 'r2', name: 'Small Boost', ton: 0.5, hashrate: 1200, label: '+1.2K H/s' },
  { id: 'r3', name: 'Medium Boost', ton: 1, hashrate: 3000, label: '+3K H/s' },
  { id: 'r4', name: 'Large Boost', ton: 5, hashrate: 20000, label: '+20K H/s' },
  { id: 'r5', name: 'Mega Boost', ton: 10, hashrate: 50000, label: '+50K H/s' },
  { id: 'r6', name: 'Ultra Boost', ton: 50, hashrate: 300000, label: '+300K H/s' },
];

router.get('/reinvest/plans', (req, res) => { res.json({ plans: REINVEST_PLANS }); });

router.post('/reinvest', async (req, res) => {
  try {
    const { telegram_id, plan_id } = req.body;
    const plan = REINVEST_PLANS.find(p => p.id === plan_id);
    if (!plan) return res.status(400).json({ error: 'Invalid plan' });

    const user = await getOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegram_id)]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user.balance_ton || 0) < plan.ton) return res.status(400).json({ error: `Need ${plan.ton} TON` });

    await runQuery(`UPDATE users SET balance_ton = balance_ton - ?, hashrate = hashrate + ?, last_active_at = NOW() WHERE id = ?`, [plan.ton, plan.hashrate, user.id]);
    await runQuery(`INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'reinvest', ?, ?)`, [user.id, -plan.ton, `Reinvested ${plan.ton} TON → ${plan.label}`]);

    const updated = await getOne('SELECT * FROM users WHERE id = ?', [user.id]);
    res.json({ message: `${plan.name} activated! +${plan.hashrate} H/s`, balance_ton: updated.balance_ton, new_hashrate: updated.hashrate });
  } catch (err) {
    console.error('Reinvest error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
