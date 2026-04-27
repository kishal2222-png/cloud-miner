const express = require('express');
const router = express.Router();
const { getOne, getAll, runQuery } = require('../database');

// Admin telegram_id — set in .env or hardcode yours
const ADMIN_IDS = (process.env.ADMIN_IDS || '123456789').split(',').map(s => s.trim());

function isAdmin(req, res, next) {
  const adminId = req.headers['x-admin-id'] || req.query.admin_id;
  if (!ADMIN_IDS.includes(String(adminId))) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

// Dashboard stats
router.get('/stats', isAdmin, (req, res) => {
  try {
    const totalUsers = getOne('SELECT COUNT(*) as count FROM users')?.count || 0;
    const activeMiners = getOne('SELECT COUNT(*) as count FROM users WHERE is_mining = 1')?.count || 0;
    const totalMined = getOne('SELECT SUM(total_mined_ton) as total FROM users')?.total || 0;
    const totalBalance = getOne('SELECT SUM(balance_ton) as total FROM users')?.total || 0;
    const totalHashrate = getOne('SELECT SUM(hashrate) as total FROM users')?.total || 0;
    const pendingWithdrawals = getOne("SELECT COUNT(*) as count FROM withdrawals WHERE status = 'pending'")?.count || 0;
    const pendingAmount = getOne("SELECT SUM(amount) as total FROM withdrawals WHERE status = 'pending'")?.total || 0;
    const totalWithdrawn = getOne("SELECT SUM(amount) as total FROM withdrawals WHERE status = 'completed'")?.total || 0;
    const purchasedMiners = getOne('SELECT COUNT(*) as count FROM miners')?.count || 0;

    res.json({
      totalUsers,
      activeMiners,
      totalMined: totalMined || 0,
      totalBalance: totalBalance || 0,
      totalHashrate: totalHashrate || 0,
      pendingWithdrawals,
      pendingAmount: pendingAmount || 0,
      totalWithdrawn: totalWithdrawn || 0,
      purchasedMiners
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All users
router.get('/users', isAdmin, (req, res) => {
  try {
    const users = getAll('SELECT * FROM users ORDER BY created_at DESC');
    res.json({ users });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Edit user balance
router.post('/users/edit-balance', isAdmin, (req, res) => {
  try {
    const { user_id, balance_ton } = req.body;
    runQuery('UPDATE users SET balance_ton = ? WHERE id = ?', [parseFloat(balance_ton), user_id]);
    runQuery(
      `INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'admin_edit', ?, 'Admin balance edit')`,
      [user_id, parseFloat(balance_ton)]
    );
    const user = getOne('SELECT * FROM users WHERE id = ?', [user_id]);
    res.json({ message: 'Balance updated', user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Edit user hashrate
router.post('/users/edit-hashrate', isAdmin, (req, res) => {
  try {
    const { user_id, hashrate } = req.body;
    runQuery('UPDATE users SET hashrate = ? WHERE id = ?', [parseInt(hashrate), user_id]);
    const user = getOne('SELECT * FROM users WHERE id = ?', [user_id]);
    res.json({ message: 'Hashrate updated', user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ban/unban user
router.post('/users/toggle-ban', isAdmin, (req, res) => {
  try {
    const { user_id } = req.body;
    const user = getOne('SELECT * FROM users WHERE id = ?', [user_id]);
    const newStatus = user.is_mining ? 0 : 1;
    runQuery('UPDATE users SET is_mining = ? WHERE id = ?', [newStatus, user_id]);
    res.json({ message: newStatus ? 'User unbanned' : 'User banned' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// All withdrawals
router.get('/withdrawals', isAdmin, (req, res) => {
  try {
    const withdrawals = getAll(`
      SELECT w.*, u.telegram_id, u.username, u.first_name 
      FROM withdrawals w 
      JOIN users u ON w.user_id = u.id 
      ORDER BY w.created_at DESC
    `);
    res.json({ withdrawals });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Approve withdrawal
router.post('/withdrawals/approve', isAdmin, (req, res) => {
  try {
    const { withdrawal_id } = req.body;
    runQuery("UPDATE withdrawals SET status = 'completed', processed_at = datetime('now') WHERE id = ?", [withdrawal_id]);
    res.json({ message: 'Withdrawal approved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Reject withdrawal
router.post('/withdrawals/reject', isAdmin, (req, res) => {
  try {
    const { withdrawal_id } = req.body;
    const w = getOne('SELECT * FROM withdrawals WHERE id = ?', [withdrawal_id]);
    if (w && w.status === 'pending') {
      // Return TON to user
      runQuery('UPDATE users SET balance_ton = balance_ton + ? WHERE id = ?', [w.amount, w.user_id]);
      runQuery("UPDATE withdrawals SET status = 'rejected', processed_at = datetime('now') WHERE id = ?", [withdrawal_id]);
      runQuery(
        `INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'withdrawal_refund', ?, 'Withdrawal rejected — refunded')`,
        [w.user_id, w.amount]
      );
    }
    res.json({ message: 'Withdrawal rejected, TON refunded' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Recent transactions
router.get('/transactions', isAdmin, (req, res) => {
  try {
    const transactions = getAll(`
      SELECT t.*, u.telegram_id, u.username, u.first_name 
      FROM transactions t 
      JOIN users u ON t.user_id = u.id 
      ORDER BY t.created_at DESC 
      LIMIT 100
    `);
    res.json({ transactions });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
