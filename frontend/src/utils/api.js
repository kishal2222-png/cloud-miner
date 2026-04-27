const API_BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  auth: (data) => request('/users/auth', { method: 'POST', body: JSON.stringify(data) }),
  getUser: (telegramId) => request(`/users/${telegramId}`),
  getTransactions: (telegramId) => request(`/users/${telegramId}/transactions`),

  getMiningStatus: (telegramId) => request(`/mining/status/${telegramId}`),
  collectMining: (telegram_id) => request('/mining/collect', { method: 'POST', body: JSON.stringify({ telegram_id }) }),
  getReinvestPlans: () => request('/mining/reinvest/plans'),
  reinvest: (telegram_id, plan_id) => request('/mining/reinvest', { method: 'POST', body: JSON.stringify({ telegram_id, plan_id }) }),

  buyHashrate: (telegram_id, hashrate) => request('/miners/buy', { method: 'POST', body: JSON.stringify({ telegram_id, hashrate }) }),
  getHashratePrice: () => request('/miners/price'),

  getReferrals: (telegramId) => request(`/referrals/${telegramId}`),
  getLeaderboard: () => request('/leaderboard'),

  createWithdrawal: (data) => request('/withdrawals/create', { method: 'POST', body: JSON.stringify(data) }),
  getWithdrawals: (telegramId) => request(`/withdrawals/${telegramId}`),

  // Deposit (TON → hashrate)
  createDeposit: (telegram_id, hashrate) => request('/deposit/create', { method: 'POST', body: JSON.stringify({ telegram_id, hashrate }) }),
  checkDeposit: (telegram_id, id) => request(`/deposit/check/${id}`, { method: 'POST', body: JSON.stringify({ telegram_id }) }),
  cancelDeposit: (telegram_id, id) => request(`/deposit/cancel/${id}`, { method: 'POST', body: JSON.stringify({ telegram_id }) }),
  getDepositHistory: (telegramId) => request(`/deposit/history/${telegramId}`),
};
