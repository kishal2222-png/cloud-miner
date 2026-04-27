const express = require('express');
const router = express.Router();
const { getOne, getAll, runQuery } = require('../database');

router.post('/create', async (req, res) => {
  try {
    const { telegram_id, amount, wallet_address } = req.body;
    if (!wallet_address) return res.status(400).json({ error: 'Wallet address required' });
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });

    const user = await getOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegram_id)]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.balance_ton < amount) return res.status(400).json({ error: 'Insufficient balance' });
    if (amount < 0.5) return res.status(400).json({ error: 'Minimum withdrawal: 0.5 TON' });

    await runQuery('UPDATE users SET balance_ton = balance_ton - ? WHERE id = ?', [amount, user.id]);
    await runQuery('INSERT INTO withdrawals (user_id, amount, wallet_address) VALUES (?, ?, ?)', [user.id, amount, wallet_address]);
    await runQuery('INSERT INTO transactions (user_id, type, amount, description) VALUES (?, ?, ?, ?)',
      [user.id, 'withdrawal', -amount, `Withdrawal to ${wallet_address.substring(0, 10)}...`]);

    res.json({ message: 'Withdrawal request created' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.get('/:telegramId', async (req, res) => {
  try {
    const user = await getOne('SELECT id FROM users WHERE telegram_id = ?', [req.params.telegramId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const withdrawals = await getAll('SELECT * FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 50', [user.id]);
    res.json({ withdrawals });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
