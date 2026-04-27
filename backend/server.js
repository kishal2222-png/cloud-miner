require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const { initDatabase, getAll, runQuery, getOne } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/dist')));

async function start() {
  await initDatabase();

  app.use('/api/users', require('./routes/users'));
  app.use('/api/mining', require('./routes/mining'));
  app.use('/api/miners', require('./routes/miners'));
  app.use('/api/deposit', require('./routes/deposit'));
  app.use('/api/referrals', require('./routes/referrals'));
  app.use('/api/leaderboard', require('./routes/leaderboard'));
  app.use('/api/withdrawals', require('./routes/withdrawals'));
  app.use('/api/admin', require('./routes/admin'));

  try { require('./services/bot'); } catch (e) { console.warn('Bot not started:', e.message); }

  // Start deposit checker (every 5 min, auto-confirm by blockchain)
  try {
    const { startDepositChecker } = require('./services/depositChecker');
    startDepositChecker();
  } catch (e) { console.warn('Deposit checker error:', e.message); }

  // Mining cron — every minute
  cron.schedule('* * * * *', async () => {
    try {
      const activeUsers = await getAll('SELECT u.id, u.hashrate, u.is_mining FROM users u WHERE u.is_mining = 1');
      const TON_RATE = 0.00001;

      for (const user of activeUsers) {
        const miners = await getAll(
          `SELECT * FROM miners WHERE user_id = ? AND is_active = 1 AND expires_at > NOW()`, [user.id]
        );
        const bonusHash = miners.reduce((s, m) => s + m.hashrate, 0);
        const totalHash = user.hashrate + bonusHash;
        const mined = (totalHash / 1000000) * TON_RATE;

        await runQuery(
          `UPDATE users SET balance_ton = balance_ton + ?, total_mined_ton = total_mined_ton + ?, last_active_at = NOW() WHERE id = ?`,
          [mined, mined, user.id]
        );
      }

      await runQuery(`UPDATE miners SET is_active = 0 WHERE is_active = 1 AND expires_at <= NOW()`);

      // Expire old pending deposits (> 1 hour)
      await runQuery("UPDATE pending_deposits SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW()");
    } catch (err) {
      console.error('Mining cron error:', err.message);
    }
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });

  app.listen(PORT, () => { console.log(`🚀 Cloud Miner Backend running on port ${PORT}`); });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });
