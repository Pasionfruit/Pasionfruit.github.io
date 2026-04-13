import { useMemo, useState } from 'react'
import { useBankroll } from '../context/BankrollContext'

function AdminPage() {
  const {
    users,
    currentUser,
    setBalanceForUser,
    adjustBalanceForUser,
    createUser,
  } = useBankroll()

  const [selectedId, setSelectedId] = useState(users[0]?.id || null)
  const [amount, setAmount] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [refreshStatus, setRefreshStatus] = useState('')
  const { fetchRemoteProfiles } = useBankroll()

  const selectedUser = useMemo(() => users.find((u) => u.id === selectedId), [users, selectedId])

  const canAccess = currentUser?.isAdmin

  if (!canAccess) {
    return (
      <main>
        <h1>Admin</h1>
        <p>You must be an admin to access this page.</p>
      </main>
    )
  }

  const handleSet = () => {
    const parsed = Number(amount)
    if (!Number.isFinite(parsed)) return
    setBalanceForUser(selectedId, parsed)
  }

  const handleAdjust = () => {
    const parsed = Number(amount)
    if (!Number.isFinite(parsed)) return
    adjustBalanceForUser(selectedId, parsed)
  }

  const handleCreate = () => {
    if (!newUserName) return
    createUser(newUserName)
    setNewUserName('')
  }

  const handleRefresh = async () => {
    setRefreshStatus('Refreshing...')
    const ok = await fetchRemoteProfiles()
    setRefreshStatus(ok ? 'Refreshed ✅' : 'Refresh failed')
    setTimeout(() => setRefreshStatus(''), 3000)
  }

  return (
    <main className="admin-page">
      <header>
        <h1>Admin Console</h1>
        <p>Adjust player balances and create accounts.</p>
      </header>

      <section className="admin-grid">
        <div className="players-list">
          <h2>Players</h2>
          <ul>
            {users.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => setSelectedId(u.id)} className={u.id === selectedId ? 'active' : ''}>
                  {u.name} {u.isAdmin ? '(admin)' : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="player-controls">
          <h2>Selected</h2>
          {selectedUser ? (
            <>
              <div className="player-row">
                <div className="label">Name</div>
                <div>{selectedUser.name}</div>
              </div>
              <div className="player-row">
                <div className="label">Balance</div>
                <div>${selectedUser.balance.toFixed(2)}</div>
              </div>

              <div className="controls">
                <label>
                  Amount
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 100 or -25" />
                </label>
                <div className="actions">
                  <button type="button" onClick={handleSet}>Set</button>
                  <button type="button" onClick={handleAdjust}>Adjust (+/-)</button>
                </div>
              </div>
            </>
          ) : (
            <p>No user selected</p>
          )}

          <div className="create-user">
            <h3>Create new user</h3>
            <label>
              Name
              <input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="New user name" />
            </label>
            <div className="actions">
              <button type="button" onClick={handleCreate}>Create</button>
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button type="button" onClick={handleRefresh}>Refresh profiles from Sheet</button>
            <span style={{ marginLeft: '0.75rem' }}>{refreshStatus}</span>
          </div>
        </div>
      </section>
    </main>
  )
}

export default AdminPage
