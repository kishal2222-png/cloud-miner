import React, { useState, useEffect } from 'react';
import './AdminPage.css';

const API = '/api/admin';
const ADMIN_ID = '123456789'; // dev mode

async function adminFetch(url, options = {}) {
  const res = await fetch(`${API}${url}`, {
    headers: { 'Content-Type': 'application/json', 'X-Admin-Id': ADMIN_ID },
    ...options
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed');
  return res.json();
}

function AdminPage() {
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [editUser, setEditUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { loadTab(tab); }, [tab]);

  async function loadTab(t) {
    setLoading(true);
    try {
      if (t === 'stats') { setStats(await adminFetch('/stats')); }
      if (t === 'users') { setUsers((await adminFetch('/users')).users); }
      if (t === 'withdrawals') { setWithdrawals((await adminFetch('/withdrawals')).withdrawals); }
      if (t === 'transactions') { setTransactions((await adminFetch('/transactions')).transactions); }
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
    setLoading(false);
  }

  async function approveWithdrawal(id) {
    try {
      await adminFetch('/withdrawals/approve', { method: 'POST', body: JSON.stringify({ withdrawal_id: id }) });
      setMsg({ type: 'success', text: 'Withdrawal approved' });
      loadTab('withdrawals');
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function rejectWithdrawal(id) {
    if (!confirm('Reject and refund?')) return;
    try {
      await adminFetch('/withdrawals/reject', { method: 'POST', body: JSON.stringify({ withdrawal_id: id }) });
      setMsg({ type: 'success', text: 'Withdrawal rejected, TON refunded' });
      loadTab('withdrawals');
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function saveEditUser() {
    try {
      await adminFetch('/users/edit-balance', { method: 'POST', body: JSON.stringify({ user_id: editUser.id, balance_ton: editUser.balance_ton }) });
      await adminFetch('/users/edit-hashrate', { method: 'POST', body: JSON.stringify({ user_id: editUser.id, hashrate: editUser.hashrate }) });
      setMsg({ type: 'success', text: 'User updated' });
      setEditUser(null);
      loadTab('users');
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  async function toggleBan(userId) {
    try {
      const result = await adminFetch('/users/toggle-ban', { method: 'POST', body: JSON.stringify({ user_id: userId }) });
      setMsg({ type: 'success', text: result.message });
      loadTab('users');
    } catch (err) { setMsg({ type: 'error', text: err.message }); }
  }

  function fmtDate(d) { return d ? new Date(d).toLocaleString() : '—'; }
  function fmtTon(v) { return (v || 0).toFixed(5); }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1 className="admin-title">⚙️ Admin Panel</h1>
        <a href="/" className="admin-back">← Back to App</a>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {['stats', 'users', 'withdrawals', 'transactions'].map(t => (
          <button key={t} className={`admin-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t === 'stats' && '📊 '}
            {t === 'users' && '👥 '}
            {t === 'withdrawals' && '💸 '}
            {t === 'transactions' && '📜 '}
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`admin-msg ${msg.type}`} onClick={() => setMsg(null)}>
          {msg.type === 'success' ? '✅' : '❌'} {msg.text}
        </div>
      )}

      {loading && <div className="admin-loading">Loading...</div>}

      {/* Stats Tab */}
      {tab === 'stats' && stats && (
        <div className="stats-dashboard">
          <div className="stats-grid">
            <div className="stats-card blue">
              <div className="stats-card-value">{stats.totalUsers}</div>
              <div className="stats-card-label">Total Users</div>
            </div>
            <div className="stats-card green">
              <div className="stats-card-value">{stats.activeMiners}</div>
              <div className="stats-card-label">Active Miners</div>
            </div>
            <div className="stats-card orange">
              <div className="stats-card-value">{fmtTon(stats.totalMined)}</div>
              <div className="stats-card-label">Total Mined TON</div>
            </div>
            <div className="stats-card purple">
              <div className="stats-card-value">{fmtTon(stats.totalBalance)}</div>
              <div className="stats-card-label">Total Balances</div>
            </div>
            <div className="stats-card red">
              <div className="stats-card-value">{stats.pendingWithdrawals}</div>
              <div className="stats-card-label">Pending Withdrawals</div>
            </div>
            <div className="stats-card cyan">
              <div className="stats-card-value">{fmtTon(stats.pendingAmount)}</div>
              <div className="stats-card-label">Pending Amount</div>
            </div>
            <div className="stats-card teal">
              <div className="stats-card-value">{fmtTon(stats.totalWithdrawn)}</div>
              <div className="stats-card-label">Total Withdrawn</div>
            </div>
            <div className="stats-card amber">
              <div className="stats-card-value">{stats.purchasedMiners}</div>
              <div className="stats-card-label">Purchased Miners</div>
            </div>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="admin-section">
          <div className="admin-section-header">
            <span>👥 Users ({users.length})</span>
          </div>

          {/* Edit modal */}
          {editUser && (
            <div className="edit-modal">
              <div className="edit-modal-content">
                <h3>Edit: {editUser.first_name || editUser.username || `#${editUser.id}`}</h3>
                <div className="edit-field">
                  <label>Balance (TON)</label>
                  <input type="number" step="any" value={editUser.balance_ton} onChange={e => setEditUser({...editUser, balance_ton: e.target.value})} />
                </div>
                <div className="edit-field">
                  <label>Hashrate (H/s)</label>
                  <input type="number" value={editUser.hashrate} onChange={e => setEditUser({...editUser, hashrate: e.target.value})} />
                </div>
                <div className="edit-actions">
                  <button className="btn-save" onClick={saveEditUser}>💾 Save</button>
                  <button className="btn-cancel" onClick={() => setEditUser(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}

          <div className="users-list">
            {users.map(u => (
              <div key={u.id} className="user-card">
                <div className="user-card-top">
                  <div className="user-avatar-admin">{u.first_name ? u.first_name[0] : '?'}</div>
                  <div className="user-info-admin">
                    <div className="user-name-admin">{u.first_name || 'No name'} <span className="user-tg">@{u.username || u.telegram_id}</span></div>
                    <div className="user-meta">ID: {u.telegram_id} • Joined: {fmtDate(u.created_at)}</div>
                  </div>
                </div>
                <div className="user-card-stats">
                  <div className="user-stat"><span>Balance</span><span className="val-blue">{fmtTon(u.balance_ton)} TON</span></div>
                  <div className="user-stat"><span>Hashrate</span><span className="val-green">{u.hashrate} H/s</span></div>
                  <div className="user-stat"><span>Mined</span><span className="val-orange">{fmtTon(u.total_mined_ton)} TON</span></div>
                  <div className="user-stat"><span>Status</span><span className={u.is_mining ? 'val-green' : 'val-red'}>{u.is_mining ? 'Active' : 'Banned'}</span></div>
                </div>
                <div className="user-card-actions">
                  <button className="btn-edit" onClick={() => setEditUser({...u})}>✏️ Edit</button>
                  <button className={u.is_mining ? 'btn-ban' : 'btn-unban'} onClick={() => toggleBan(u.id)}>
                    {u.is_mining ? '🚫 Ban' : '✅ Unban'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Withdrawals Tab */}
      {tab === 'withdrawals' && (
        <div className="admin-section">
          <div className="admin-section-header">💸 Withdrawals ({withdrawals.length})</div>
          <div className="withdrawals-list">
            {withdrawals.map(w => (
              <div key={w.id} className={`withdrawal-card status-${w.status}`}>
                <div className="withdrawal-card-top">
                  <div>
                    <div className="withdrawal-user">{w.first_name || w.username || w.telegram_id}</div>
                    <div className="withdrawal-wallet">{w.wallet_address}</div>
                    <div className="withdrawal-date-admin">{fmtDate(w.created_at)}</div>
                  </div>
                  <div className="withdrawal-amount-admin">{fmtTon(w.amount)} TON</div>
                </div>
                <div className="withdrawal-card-bottom">
                  <span className={`withdrawal-badge ${w.status}`}>{w.status}</span>
                  {w.status === 'pending' && (
                    <div className="withdrawal-actions">
                      <button className="btn-approve" onClick={() => approveWithdrawal(w.id)}>✅ Approve</button>
                      <button className="btn-reject" onClick={() => rejectWithdrawal(w.id)}>❌ Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {withdrawals.length === 0 && <div className="admin-empty">No withdrawals yet</div>}
          </div>
        </div>
      )}

      {/* Transactions Tab */}
      {tab === 'transactions' && (
        <div className="admin-section">
          <div className="admin-section-header">📜 Recent Transactions (last 100)</div>
          <div className="transactions-list">
            {transactions.map(t => (
              <div key={t.id} className="tx-row">
                <div className="tx-left">
                  <span className="tx-type">{t.type}</span>
                  <span className="tx-user">{t.first_name || t.telegram_id}</span>
                </div>
                <div className="tx-right">
                  <span className={`tx-amount ${t.amount >= 0 ? 'positive' : 'negative'}`}>
                    {t.amount >= 0 ? '+' : ''}{fmtTon(t.amount)} TON
                  </span>
                  <span className="tx-date">{fmtDate(t.created_at)}</span>
                </div>
              </div>
            ))}
            {transactions.length === 0 && <div className="admin-empty">No transactions</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPage;
