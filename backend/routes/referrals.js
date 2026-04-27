const express = require('express');
const router = express.Router();
const { getOne, getAll } = require('../database');

router.get('/:telegramId', async (req, res) => {
  try {
    const user = await getOne('SELECT * FROM users WHERE telegram_id = ?', [req.params.telegramId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const referrals = await getAll(`
      SELECT u.first_name, u.username, u.last_active_at, r.created_at as joined_at
      FROM referrals r JOIN users u ON u.id = r.referred_id
      WHERE r.referrer_id = ? ORDER BY r.created_at DESC
    `, [user.id]);

    res.json({ referral_code: user.referral_code, referral_count: referrals.length, total_bonus_hashrate: referrals.length * 50, referrals });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
