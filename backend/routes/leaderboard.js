const express = require('express');
const router = express.Router();
const { getAll } = require('../database');

router.get('/', (req, res) => {
  try {
    const leaders = getAll(`
      SELECT telegram_id, first_name, username, total_mined_ton, hashrate, level, photo_url
      FROM users ORDER BY total_mined_ton DESC LIMIT 100
    `);
    res.json({ leaders });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
