const { getAll, getOne, runQuery } = require('../database');

const TON_API_BASE = 'https://toncenter.com/api/v2';
let checkInterval = null;

/**
 * Check TON blockchain for incoming transactions matching pending deposits.
 * Runs every 5 min. Deposits expire after 1 hour.
 */
async function checkPendingDeposits() {
  const wallet = process.env.PROJECT_WALLET;
  const apiKey = process.env.TONCENTER_API_KEY || '';

  if (!wallet) {
    return { checked: 0, confirmed: 0, expired: 0, error: 'PROJECT_WALLET not set' };
  }

  let confirmed = 0;
  let expired = 0;

  try {
    // 1. Expire old pending deposits (> 1 hour)
    const expiredRows = await getAll(
      "SELECT id, user_id, amount, memo FROM pending_deposits WHERE status = 'pending' AND expires_at < NOW()"
    );
    for (const dep of expiredRows) {
      await runQuery("UPDATE pending_deposits SET status = 'expired' WHERE id = ?", [dep.id]);
      expired++;
      console.log(`⏰ [Deposit] Expired: ${dep.memo} (${dep.amount} TON) user #${dep.user_id}`);
    }

    // 2. Get active pending deposits
    const pending = await getAll(
      "SELECT * FROM pending_deposits WHERE status = 'pending' AND expires_at >= NOW() ORDER BY created_at ASC LIMIT 50"
    );

    if (pending.length === 0) {
      return { checked: 0, confirmed, expired };
    }

    // 3. Fetch recent transactions from TON blockchain
    const url = `${TON_API_BASE}/getTransactions?address=${encodeURIComponent(wallet)}&limit=100${apiKey ? '&api_key=' + apiKey : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`❌ [DepositChecker] TON API error: ${response.status}`);
      return { checked: pending.length, confirmed, expired, error: `API ${response.status}` };
    }

    const data = await response.json();
    if (!data.ok || !data.result) {
      console.error('❌ [DepositChecker] Invalid TON API response');
      return { checked: pending.length, confirmed, expired, error: 'Invalid response' };
    }

    const transactions = data.result;

    // 4. Match transactions to pending deposits by memo
    for (const dep of pending) {
      const match = transactions.find(tx => {
        if (!tx.in_msg || !tx.in_msg.value) return false;
        const value = parseInt(tx.in_msg.value) / 1e9; // nanoTON → TON

        // Amount match (±5% tolerance)
        if (Math.abs(value - parseFloat(dep.amount)) > parseFloat(dep.amount) * 0.05) return false;

        // Check memo/comment
        let comment = tx.in_msg.message || '';
        try {
          if (comment && !comment.includes('-')) {
            comment = Buffer.from(comment, 'base64').toString('utf8');
          }
        } catch (e) { comment = tx.in_msg.message || ''; }

        return comment.trim().toUpperCase() === dep.memo.toUpperCase();
      });

      if (match) {
        const txHash = match.transaction_id?.hash || 'unknown';

        await runQuery(
          "UPDATE pending_deposits SET status = 'confirmed', tx_hash = ?, confirmed_at = NOW() WHERE id = ?",
          [txHash, dep.id]
        );
        await runQuery(
          'UPDATE users SET balance_ton = balance_ton + ?, hashrate = hashrate + ? WHERE id = ?',
          [dep.amount, dep.hashrate, dep.user_id]
        );
        await runQuery(
          `INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'deposit', ?, ?)`,
          [dep.user_id, dep.amount, `Deposit confirmed: ${dep.memo} → +${dep.hashrate} H/s (tx: ${txHash.substring(0, 12)}...)`]
        );

        confirmed++;
        console.log(`✅ [Deposit] Auto-confirmed: ${dep.memo} → ${dep.amount} TON, +${dep.hashrate} H/s (user #${dep.user_id})`);
      }
    }

    return { checked: pending.length, confirmed, expired };
  } catch (error) {
    console.error('❌ [DepositChecker] Error:', error.message);
    return { checked: 0, confirmed, expired, error: error.message };
  }
}

/**
 * Check a single deposit by ID (manual check from user).
 */
async function checkSingleDeposit(depositId) {
  const dep = await getOne("SELECT * FROM pending_deposits WHERE id = ?", [depositId]);
  if (!dep) return { error: 'Deposit not found' };
  if (dep.status !== 'pending') return { status: dep.status, message: 'Already processed' };

  if (new Date(dep.expires_at) < new Date()) {
    await runQuery("UPDATE pending_deposits SET status = 'expired' WHERE id = ?", [dep.id]);
    return { status: 'expired', message: 'Deposit expired' };
  }

  const wallet = process.env.PROJECT_WALLET;
  const apiKey = process.env.TONCENTER_API_KEY || '';
  if (!wallet) return { error: 'Wallet not set' };

  try {
    const url = `${TON_API_BASE}/getTransactions?address=${encodeURIComponent(wallet)}&limit=100${apiKey ? '&api_key=' + apiKey : ''}`;
    const response = await fetch(url);
    if (!response.ok) return { error: `TON API error: ${response.status}` };

    const data = await response.json();
    if (!data.ok || !data.result) return { error: 'Invalid API response' };

    for (const tx of data.result) {
      if (!tx.in_msg || !tx.in_msg.value) continue;
      const value = parseInt(tx.in_msg.value) / 1e9;
      if (Math.abs(value - parseFloat(dep.amount)) > parseFloat(dep.amount) * 0.05) continue;

      let comment = tx.in_msg.message || '';
      try {
        if (comment && !comment.includes('-')) {
          comment = Buffer.from(comment, 'base64').toString('utf8');
        }
      } catch (e) {}

      if (comment.trim().toUpperCase() === dep.memo.toUpperCase()) {
        const txHash = tx.transaction_id?.hash || 'unknown';

        await runQuery(
          "UPDATE pending_deposits SET status = 'confirmed', tx_hash = ?, confirmed_at = NOW() WHERE id = ?",
          [txHash, dep.id]
        );
        await runQuery(
          'UPDATE users SET balance_ton = balance_ton + ?, hashrate = hashrate + ? WHERE id = ?',
          [dep.amount, dep.hashrate, dep.user_id]
        );
        await runQuery(
          `INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'deposit', ?, ?)`,
          [dep.user_id, dep.amount, `Deposit confirmed: ${dep.memo} → +${dep.hashrate} H/s`]
        );

        console.log(`✅ [Deposit] Manual confirm: ${dep.memo} → ${dep.amount} TON (user #${dep.user_id})`);
        return { status: 'confirmed', amount: dep.amount, tx_hash: txHash };
      }
    }

    return { status: 'pending', message: 'Transaction not found yet. Try again later.' };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Start cron — every 5 minutes for 1 hour window.
 */
function startDepositChecker() {
  if (checkInterval) return;

  console.log('🔄 Deposit checker started (every 5 min, 1h window)');
  checkInterval = setInterval(async () => {
    try {
      const result = await checkPendingDeposits();
      if (result.confirmed > 0 || result.expired > 0) {
        console.log(`💰 [DepositChecker] Checked: ${result.checked}, Confirmed: ${result.confirmed}, Expired: ${result.expired}`);
      }
    } catch (error) {
      console.error('❌ [DepositChecker] Cron error:', error.message);
    }
  }, 5 * 60 * 1000); // every 5 minutes

  // Run immediately on start
  checkPendingDeposits().catch(() => {});
}

function stopDepositChecker() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('⏹️ Deposit checker stopped');
  }
}

module.exports = {
  checkPendingDeposits,
  checkSingleDeposit,
  startDepositChecker,
  stopDepositChecker,
};
