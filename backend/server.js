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
  app.use('/api/referrals', require('./routes/referrals'));
  app.use('/api/leaderboard', require('./routes/leaderboard'));
  app.use('/api/withdrawals', require('./routes/withdrawals'));
  app.use('/api/admin', require('./routes/admin'));

  try { require('./services/bot'); } catch (e) { console.warn('Bot not started:', e.message); }

  // Mining cron — every minute, TON only
  cron.schedule('* * * * *', () => {
    try {
      const activeUsers = getAll('SELECT u.id, u.hashrate, u.is_mining FROM users u WHERE u.is_mining = 1');
      const TON_RATE = 0.00001; // TON per H/s per minute

      for (const user of activeUsers) {
        const miners = getAll(
          `SELECT * FROM miners WHERE user_id = ? AND is_active = 1 AND expires_at > datetime('now')`, [user.id]
        );
        const bonusHash = miners.reduce((s, m) => s + m.hashrate, 0);
        const totalHash = user.hashrate + bonusHash;
        const mined = (totalHash / 1000000) * TON_RATE;

        runQuery(
          `UPDATE users SET balance_ton = balance_ton + ?, total_mined_ton = total_mined_ton + ?, last_active_at = datetime('now') WHERE id = ?`,
          [mined, mined, user.id]
        );
      }

      runQuery(`UPDATE miners SET is_active = 0 WHERE is_active = 1 AND expires_at <= datetime('now')`);
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
