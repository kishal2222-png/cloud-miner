const express = require('express');
const router = express.Router();
const { getOne, getAll, runQuery } = require('../database');

const ADMIN_IDS = (process.env.ADMIN_IDS || '123456789').split(',').map(s => s.trim());

function isAdmin(req, res, next) {
  const adminId = req.headers['x-admin-id'] || req.query.admin_id;
  if (!ADMIN_IDS.includes(String(adminId))) return res.status(403).json({ error: 'Access denied' });
  next();
}

router.get('/stats', isAdmin, async (req, res) => {
  try {
    const totalUsers = (await getOne('SELECT COUNT(*) as count FROM users'))?.count || 0;
    const activeMiners = (await getOne('SELECT COUNT(*) as count FROM users WHERE is_mining = 1'))?.count || 0;
    const totalMined = (await getOne('SELECT SUM(total_mined_ton) as total FROM users'))?.total || 0;
    const totalBalance = (await getOne('SELECT SUM(balance_ton) as total FROM users'))?.total || 0;
    const totalHashrate = (await getOne('SELECT SUM(hashrate) as total FROM users'))?.total || 0;
    const pendingWithdrawals = (await getOne("SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'"))?.count || 0;
    const pendingAmount = (await getOne("SELECT SUM(amount) as total FROM withdrawals WHERE status = 'pending'"))?.total || 0;
    const totalWithdrawn = (await getOne("SELECT SUM(amount) as total FROM withdrawals WHERE status = 'completed'"))?.total || 0;
    const purchasedMiners = (await getOne('SELECT COUNT(*) as count FROM miners'))?.count || 0;
    const pendingDeposits = (await getOne("SELECT COUNT(*) as count FROM pending_deposits WHERE status = 'pending'"))?.count || 0;

    res.json({ totalUsers, activeMiners, totalMined: totalMined || 0, totalBalance: totalBalance || 0, totalHashrate: totalHashrate || 0, pendingWithdrawals, pendingAmount: pendingAmount || 0, totalWithdrawn: totalWithdrawn || 0, purchasedMiners, pendingDeposits });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/users', isAdmin, async (req, res) => {
  try { res.json({ users: await getAll('SELECT * FROM users ORDER BY created_at DESC') }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/edit-balance', isAdmin, async (req, res) => {
  try {
    const { user_id, balance_ton } = req.body;
    await runQuery('UPDATE users SET balance_ton = ? WHERE id = ?', [parseFloat(balance_ton), user_id]);
    await runQuery(`INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'admin_edit', ?, 'Admin balance edit')`, [user_id, parseFloat(balance_ton)]);
    res.json({ message: 'Balance updated', user: await getOne('SELECT * FROM users WHERE id = ?', [user_id]) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/edit-hashrate', isAdmin, async (req, res) => {
  try {
    const { user_id, hashrate } = req.body;
    await runQuery('UPDATE users SET hashrate = ? WHERE id = ?', [parseInt(hashrate), user_id]);
    res.json({ message: 'Hashrate updated', user: await getOne('SELECT * FROM users WHERE id = ?', [user_id]) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/users/toggle-ban', isAdmin, async (req, res) => {
  try {
    const user = await getOne('SELECT * FROM users WHERE id = ?', [req.body.user_id]);
    const newStatus = user.is_mining ? 0 : 1;
    await runQuery('UPDATE users SET is_mining = ? WHERE id = ?', [newStatus, req.body.user_id]);
    res.json({ message: newStatus ? 'User unbanned' : 'User banned' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/withdrawals', isAdmin, async (req, res) => {
  try {
    res.json({ withdrawals: await getAll(`SELECT w.*, u.telegram_id, u.username, u.first_name FROM withdrawals w JOIN users u ON w.user_id = u.id ORDER BY w.created_at DESC`) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/withdrawals/approve', isAdmin, async (req, res) => {
  try {
    await runQuery("UPDATE withdrawals SET status = 'completed', processed_at = NOW() WHERE id = ?", [req.body.withdrawal_id]);
    res.json({ message: 'Withdrawal approved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/withdrawals/reject', isAdmin, async (req, res) => {
  try {
    const w = await getOne('SELECT * FROM withdrawals WHERE id = ?', [req.body.withdrawal_id]);
    if (w && w.status === 'pending') {
      await runQuery('UPDATE users SET balance_ton = balance_ton + ? WHERE id = ?', [w.amount, w.user_id]);
      await runQuery("UPDATE withdrawals SET status = 'rejected', processed_at = NOW() WHERE id = ?", [req.body.withdrawal_id]);
    }
    res.json({ message: 'Withdrawal rejected, TON refunded' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/transactions', isAdmin, async (req, res) => {
  try {
    res.json({ transactions: await getAll(`SELECT t.*, u.telegram_id, u.username, u.first_name FROM transactions t JOIN users u ON t.user_id = u.id ORDER BY t.created_at DESC LIMIT 100`) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: get pending deposits
router.get('/deposits', isAdmin, async (req, res) => {
  try {
    res.json({ deposits: await getAll(`SELECT d.*, u.username, u.first_name FROM pending_deposits d JOIN users u ON d.user_id = u.id ORDER BY d.created_at DESC LIMIT 50`) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin: manually confirm deposit
router.post('/deposits/confirm', isAdmin, async (req, res) => {
  try {
    const dep = await getOne("SELECT * FROM pending_deposits WHERE id = ? AND status = 'pending'", [req.body.deposit_id]);
    if (!dep) return res.status(404).json({ error: 'Deposit not found' });

    await runQuery("UPDATE pending_deposits SET status = 'confirmed', confirmed_at = NOW() WHERE id = ?", [dep.id]);
    await runQuery('UPDATE users SET balance_ton = balance_ton + ?, hashrate = hashrate + ? WHERE id = ?', [dep.amount, dep.hashrate, dep.user_id]);
    await runQuery(`INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'deposit', ?, ?)`, [dep.user_id, dep.amount, `Deposit confirmed: ${dep.memo} → +${dep.hashrate} H/s`]);

    res.json({ message: `Deposit ${dep.memo} confirmed! +${dep.amount} TON, +${dep.hashrate} H/s` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
