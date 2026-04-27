# Cloud Miner — TON Mining Telegram Mini App

Telegram Mini App for cloud mining TON cryptocurrency.

## Features
- ⛏ Real-time TON mining with live balance ticker
- 💰 Collect mined TON to wallet
- ⚡ Buy mining power (100-10,000 H/s slider)
- 🔄 Reinvest earned TON into hashrate
- 💸 Withdraw TON to wallet
- 👥 Referral system (+50 H/s per invite)
- 🏆 Leaderboard
- ⚙️ Admin panel (/admin)

## Tech Stack
- **Backend:** Node.js, Express, sql.js (SQLite)
- **Frontend:** React, Vite
- **Bot:** node-telegram-bot-api

## Setup
```bash
# Backend
cd backend && npm install

# Frontend  
cd frontend && npm install

# Create .env in backend/
cp .env.example backend/.env
# Edit BOT_TOKEN and ADMIN_IDS

# Run dev
cd backend && node server.js
cd frontend && npm run dev
```

## Deploy to Railway
1. Push to GitHub
2. Connect repo in Railway
3. Set env variables: `BOT_TOKEN`, `ADMIN_IDS`, `PORT`
4. Deploy!
