const express = require('express');
const router = express.Router();
const { getOne, getAll, runQuery } = require('../database');

const PROJECT_WALLET = process.env.PROJECT_WALLET || 'UQxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
const TON_PER_HS = 0.0005; // same as miners.js

function generateMemo() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let memo = 'CV-';
  for (let i = 0; i < 8; i++) {
    memo += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return memo;
}

// POST /api/deposit/create — create pending deposit for hashrate purchase
router.post('/create', async (req, res) => {
  try {
    const { telegram_id, hashrate } = req.body;
    const hs = parseInt(hashrate);

    if (!hs || hs < 100 || hs > 10000) {
      return res.status(400).json({ error: 'Hashrate must be 100-10,000 H/s' });
    }

    const cost = Math.round(hs * TON_PER_HS * 100000) / 100000;
    const user = await getOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegram_id)]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check for existing pending deposit
    const existing = await getOne(
      "SELECT * FROM pending_deposits WHERE user_id = ? AND status = 'pending' AND expires_at > NOW()",
      [user.id]
    );
    if (existing) {
      return res.json({
        success: true,
        deposit: existing,
        wallet: PROJECT_WALLET,
        message: 'You already have a pending deposit'
      });
    }

    const memo = generateMemo();

    await runQuery(
      `INSERT INTO pending_deposits (user_id, telegram_id, amount, hashrate, memo, expires_at) VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL '1 hour')`,
      [user.id, String(telegram_id), cost, hs, memo]
    );

    const deposit = await getOne("SELECT * FROM pending_deposits WHERE user_id = ? AND memo = ?", [user.id, memo]);

    console.log(`📝 [Deposit] Created: ${memo} → ${cost} TON for +${hs} H/s (user ${telegram_id})`);

    res.json({ success: true, deposit, wallet: PROJECT_WALLET });
  } catch (err) {
    console.error('Create deposit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deposit/check/:id — manually check deposit on blockchain
router.post('/check/:id', async (req, res) => {
  try {
    const { telegram_id } = req.body;
    const depositId = parseInt(req.params.id);

    const user = await getOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegram_id)]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const dep = await getOne('SELECT * FROM pending_deposits WHERE id = ? AND user_id = ?', [depositId, user.id]);
    if (!dep) return res.status(404).json({ error: 'Deposit not found' });

    // If already confirmed, return immediately
    if (dep.status === 'confirmed') {
      return res.json({ deposit: dep, status: 'confirmed' });
    }

    // Try checking blockchain right now
    try {
      const { checkSingleDeposit } = require('../services/depositChecker');
      const result = await checkSingleDeposit(depositId);
      if (result.status === 'confirmed') {
        const updated = await getOne('SELECT * FROM pending_deposits WHERE id = ?', [depositId]);
        return res.json({ deposit: updated, status: 'confirmed', ...result });
      }
    } catch (e) {
      console.warn('Single check failed:', e.message);
    }

    // Return current status
    const updated = await getOne('SELECT * FROM pending_deposits WHERE id = ?', [depositId]);
    res.json({ deposit: updated, wallet: PROJECT_WALLET });
  } catch (err) {
    console.error('Check deposit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deposit/cancel/:id
router.post('/cancel/:id', async (req, res) => {
  try {
    const { telegram_id } = req.body;
    const depositId = parseInt(req.params.id);

    const user = await getOne('SELECT * FROM users WHERE telegram_id = ?', [String(telegram_id)]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const dep = await getOne("SELECT * FROM pending_deposits WHERE id = ? AND user_id = ? AND status = 'pending'", [depositId, user.id]);
    if (!dep) return res.status(404).json({ error: 'Deposit not found' });

    await runQuery("UPDATE pending_deposits SET status = 'cancelled' WHERE id = ?", [depositId]);
    console.log(`❌ [Deposit] Cancelled: ${dep.memo}`);

    res.json({ success: true, message: 'Deposit cancelled' });
  } catch (err) {
    console.error('Cancel deposit error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/deposit/history
router.get('/history/:telegramId', async (req, res) => {
  try {
    const user = await getOne('SELECT * FROM users WHERE telegram_id = ?', [req.params.telegramId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const deposits = await getAll(
      'SELECT * FROM pending_deposits WHERE user_id = ? ORDER BY created_at DESC LIMIT 20', [user.id]
    );
    res.json({ deposits, wallet: PROJECT_WALLET });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
