const express = require('express');
const router = express.Router();
const { getOne, getAll, runQuery } = require('../database');

router.post('/auth', (req, res) => {
  try {
    const { telegram_id, username, first_name, last_name, photo_url, referral_code } = req.body;
    if (!telegram_id) return res.status(400).json({ error: 'telegram_id is required' });

    let user = getOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegram_id)]);

    if (!user) {
      const refCode = 'CM' + Date.now().toString(36).toUpperCase();
      runQuery(
        `INSERT INTO users (telegram_id, username, first_name, last_name, photo_url, referral_code, referred_by, is_mining, mining_started_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
        [String(telegram_id), username || null, first_name || null, last_name || null, photo_url || null, refCode, referral_code || null]
      );
      user = getOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegram_id)]);

      if (referral_code) {
        const referrer = getOne('SELECT * FROM users WHERE referral_code = ?', [referral_code]);
        if (referrer) {
          runQuery('INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)', [referrer.id, user.id]);
          runQuery('UPDATE users SET hashrate = hashrate + 50 WHERE id = ?', [referrer.id]);
        }
      }
    } else {
      // Ensure mining is always on
      runQuery(
        `UPDATE users SET username = ?, first_name = ?, last_name = ?, photo_url = ?, is_mining = 1, mining_started_at = COALESCE(mining_started_at, datetime('now')), last_active_at = datetime('now') WHERE telegram_id = ?`,
        [username || null, first_name || null, last_name || null, photo_url || null, String(telegram_id)]
      );
      user = getOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegram_id)]);
    }

    const activeMiners = getAll(
      `SELECT * FROM miners WHERE user_id = ? AND is_active = 1 AND expires_at > datetime('now')`, [user.id]
    );
    const bonusHashrate = activeMiners.reduce((s, m) => s + m.hashrate, 0);

    res.json({
      user: { ...user, bonus_hashrate: bonusHashrate, total_hashrate: user.hashrate + bonusHashrate },
      miners: activeMiners
    });
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:telegramId', (req, res) => {
  try {
    const user = getOne('SELECT * FROM users WHERE telegram_id = ?', [req.params.telegramId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const activeMiners = getAll(
      `SELECT * FROM miners WHERE user_id = ? AND is_active = 1 AND expires_at > datetime('now')`, [user.id]
    );
    const bonusHashrate = activeMiners.reduce((s, m) => s + m.hashrate, 0);
    const refCount = getOne('SELECT COUNT(*) as count FROM referrals WHERE referrer_id = ?', [user.id]);

    res.json({
      user: { ...user, bonus_hashrate: bonusHashrate, total_hashrate: user.hashrate + bonusHashrate, referral_count: refCount?.count || 0 },
      miners: activeMiners
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:telegramId/transactions', (req, res) => {
  try {
    const user = getOne('SELECT id FROM users WHERE telegram_id = ?', [req.params.telegramId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const transactions = getAll('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [user.id]);
    res.json({ transactions });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
