const { Pool } = require('pg');

// DATABASE_URL is auto-set by Railway PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false,
});

/**
 * Convert SQLite-style `?` params to PostgreSQL `$1, $2, ...`
 */
function convertQuery(sql) {
  let i = 0;
  return sql
    .replace(/\?/g, () => `$${++i}`)
    .replace(/datetime\('now'\)/gi, 'NOW()')
    .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, 'SERIAL PRIMARY KEY');
}

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id TEXT UNIQUE NOT NULL,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        photo_url TEXT,
        balance_ton DOUBLE PRECISION DEFAULT 0,
        hashrate DOUBLE PRECISION DEFAULT 100,
        is_mining INTEGER DEFAULT 0,
        mining_started_at TIMESTAMPTZ,
        last_collect_at TIMESTAMPTZ,
        total_mined_ton DOUBLE PRECISION DEFAULT 0,
        referral_code TEXT UNIQUE,
        referred_by TEXT,
        referral_earnings DOUBLE PRECISION DEFAULT 0,
        level INTEGER DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_active_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS miners (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL,
        hashrate DOUBLE PRECISION NOT NULL,
        duration_days INTEGER NOT NULL,
        price_stars INTEGER DEFAULT 0,
        activated_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        is_active INTEGER DEFAULT 1
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS referrals (
        id SERIAL PRIMARY KEY,
        referrer_id INTEGER NOT NULL REFERENCES users(id),
        referred_id INTEGER NOT NULL REFERENCES users(id),
        bonus_earned DOUBLE PRECISION DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS withdrawals (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount DOUBLE PRECISION NOT NULL,
        wallet_address TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        processed_at TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pending_deposits (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        telegram_id TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        hashrate INTEGER DEFAULT 0,
        memo TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'pending',
        tx_hash TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        confirmed_at TIMESTAMPTZ
      )
    `);

    console.log('✅ PostgreSQL database initialized');
  } finally {
    client.release();
  }
}

/**
 * Run a write query (INSERT, UPDATE, DELETE)
 */
function runQuery(sql, params = []) {
  return pool.query(convertQuery(sql), params);
}

/**
 * Get one row
 */
async function getOne(sql, params = []) {
  const result = await pool.query(convertQuery(sql), params);
  return result.rows[0] || null;
}

/**
 * Get all rows
 */
async function getAll(sql, params = []) {
  const result = await pool.query(convertQuery(sql), params);
  return result.rows;
}

function saveDatabase() { /* no-op for PostgreSQL */ }
function getDb() { return pool; }

module.exports = { initDatabase, getDb, runQuery, getOne, getAll, saveDatabase };
