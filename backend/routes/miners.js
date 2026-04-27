const express = require('express');
const router = express.Router();
const { getOne, getAll, runQuery } = require('../database');

const TON_PER_HS = 0.0005;

router.post('/buy', async (req, res) => {
  try {
    const { telegram_id, hashrate } = req.body;
    const hs = parseInt(hashrate);
    if (!hs || hs < 100 || hs > 10000) return res.status(400).json({ error: 'Hashrate must be 100-10,000' });

    const cost = Math.round(hs * TON_PER_HS * 100000) / 100000;
    const user = await getOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegram_id)]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if ((user.balance_ton || 0) < cost) return res.status(400).json({ error: `Need ${cost} TON` });

    await runQuery('UPDATE users SET balance_ton = balance_ton - ?, hashrate = hashrate + ? WHERE id = ?', [cost, hs, user.id]);
    await runQuery(`INSERT INTO miners (user_id, name, hashrate, duration_days, price_stars, expires_at) VALUES (?, ?, ?, 99999, 0, '2099-12-31')`, [user.id, `+${hs} H/s Boost`, hs]);
    await runQuery(`INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'hashrate_purchase', ?, ?)`, [user.id, -cost, `Bought +${hs} H/s for ${cost} TON`]);

    const updated = await getOne('SELECT * FROM users WHERE id = ?', [user.id]);
    res.json({ message: `+${hs} H/s purchased!`, balance_ton: updated.balance_ton, new_hashrate: updated.hashrate, cost });
  } catch (err) {
    console.error('Buy error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/price', (req, res) => { res.json({ ton_per_hs: TON_PER_HS, min_hs: 100, max_hs: 10000 }); });

router.get('/:telegramId', async (req, res) => {
  try {
    const user = await getOne('SELECT id FROM users WHERE telegram_id = ?', [req.params.telegramId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const miners = await getAll('SELECT * FROM miners WHERE user_id = ? AND is_active = 1 ORDER BY activated_at DESC', [user.id]);
    res.json({ miners });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
