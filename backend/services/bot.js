const TelegramBot = require('node-telegram-bot-api');
const { getOne, runQuery } = require('../database');

const token = process.env.BOT_TOKEN;
const webAppUrl = process.env.WEBAPP_URL || 'https://your-domain.com';

if (!token || token === 'your_telegram_bot_token_here') {
  console.warn('⚠️  BOT_TOKEN not set. Bot will not start.');
  module.exports = null;
  return;
}

const bot = new TelegramBot(token, { polling: true });

bot.onText(/\/start(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const refCode = match[1] ? match[1].trim() : null;
  const existing = getOne('SELECT * FROM users WHERE telegram_id = ?', [String(chatId)]);

  if (!existing) {
    const userRef = 'CM' + Date.now().toString(36).toUpperCase();
    runQuery(
      `INSERT INTO users (telegram_id, username, first_name, last_name, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [String(chatId), msg.from.username || null, msg.from.first_name || null, msg.from.last_name || null, userRef, refCode || null]
    );
    if (refCode) {
      const referrer = getOne('SELECT * FROM users WHERE referral_code = ?', [refCode]);
      if (referrer) {
        const newUser = getOne('SELECT * FROM users WHERE telegram_id = ?', [String(chatId)]);
        runQuery('INSERT INTO referrals (referrer_id, referred_id) VALUES (?, ?)', [referrer.id, newUser.id]);
        runQuery('UPDATE users SET hashrate = hashrate + 50 WHERE id = ?', [referrer.id]);
      }
    }
  }

  bot.sendMessage(chatId,
    '⛏ *Welcome to TonVior Cloud Miner!*\n\nStart mining TON cryptocurrency — no hardware required!\n\n💎 Mine TON 24/7\n🚀 Buy mining power\n🔄 Reinvest earnings\n📤 Withdraw TON to wallet',
    { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '⛏ Open Miner', web_app: { url: webAppUrl } }]] } }
  );
});

bot.on('polling_error', (err) => console.error('Bot error:', err.message));
console.log('🤖 Bot started');
module.exports = bot;
