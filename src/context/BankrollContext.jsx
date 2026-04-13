import { createContext, useContext, useEffect, useRef, useState } from 'react'

const STARTING_BANKROLL = 1000
const USERS_KEY = 'casino-users'
const CURRENT_USER_KEY = 'casino-current-user'
const LEGACY_KEY = 'casino-shared-bankroll'

const BankrollContext = createContext(null)

function sanitizeBalance(value) {
  return Math.max(0, Math.floor(value * 100) / 100)
}

function readUsersFromStorage() {
  try {
    const raw = localStorage.getItem(USERS_KEY)

    if (!raw) return null

    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed)) return null

    return parsed
  } catch {
    return null
  }
}

function writeUsersToStorage(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function readCurrentUserIdFromStorage() {
  return localStorage.getItem(CURRENT_USER_KEY)
}

function writeCurrentUserIdToStorage(id) {
  if (id == null) {
    localStorage.removeItem(CURRENT_USER_KEY)
  } else {
    localStorage.setItem(CURRENT_USER_KEY, String(id))
  }
}

function makeUser(name, opts = {}) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
  return {
    id,
    name,
    balance: typeof opts.balance === 'number' ? sanitizeBalance(opts.balance) : STARTING_BANKROLL,
    isAdmin: Boolean(opts.isAdmin),
    email: opts.email || null,
    googleId: opts.googleId || null,
  }
}

export function BankrollProvider({ children }) {
  const storedUsers = readUsersFromStorage()
  const [users, setUsers] = useState(() => {
    if (storedUsers && storedUsers.length > 0) return storedUsers

    // If an old single-user balance key exists, migrate it into a single player account
    try {
      const legacy = localStorage.getItem(LEGACY_KEY)
      const parsed = Number(legacy)
      if (Number.isFinite(parsed) && parsed >= 0) {
        const migrated = makeUser('Player', { balance: parsed })
        const admin = makeUser('Admin', { isAdmin: true })
        const initial = [migrated, admin]
        writeUsersToStorage(initial)
        return initial
      }
    } catch {
      // fallthrough to defaults
    }

    // Create a sensible initial state: one default player and one admin account
    const player = makeUser('Player')
    const admin = makeUser('Admin', { isAdmin: true })
    const initial = [player, admin]
    writeUsersToStorage(initial)
    return initial
  })

  const [currentUserId, setCurrentUserId] = useState(() => readCurrentUserIdFromStorage() || (users[0] && users[0].id))

  // Keep a ref for quick non-render reads, but prefer `users` state during render
  const usersRef = useRef(users)

  useEffect(() => {
    usersRef.current = users
    writeUsersToStorage(users)
  }, [users])

  // Attempt to load profiles from a local server (if running). If profiles exist,
  // Provide a callable function to fetch profiles from the server. We call it
  // on mount, and also expose it so the Admin UI can manually refresh.
  const fetchRemoteProfiles = async () => {
    try {
      const resp = await fetch('/profiles')
      if (!resp.ok) return false
      const rows = await resp.json()
      if (!Array.isArray(rows) || rows.length === 0) return false

      // Map sheet rows (rowIndex, name, email, balance) into users
      const mapped = rows.map((r) => ({
        id: `sheet-${r.rowIndex}`,
        name: r.name || `Player-${r.rowIndex}`,
        email: r.email || null,
        balance: typeof r.balance === 'number' ? sanitizeBalance(r.balance) : sanitizeBalance(Number(r.balance) || 0),
        isAdmin: false,
      }))

      // If any of the sheet rows have the name 'Admin' (case-insensitive), mark as admin
      mapped.forEach((u) => {
        if (u.name && u.name.toLowerCase() === 'admin') u.isAdmin = true
      })

      setUsers(mapped)
      setCurrentUserId(mapped[0]?.id ?? null)
      return true
    } catch (err) {
      // network errors/absent server are fine; keep local users
      return false
    }
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      if (!mounted) return
      await fetchRemoteProfiles()
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    writeCurrentUserIdToStorage(currentUserId)
  }, [currentUserId])

  const getUserById = (id) => users.find((u) => u.id === id) || null

  // currentUser derived from state for safe render-time access
  const currentUser = users.find((u) => u.id === currentUserId) || null

  const updateUser = (id, patch) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)))
  }

  const login = (name) => {
    if (!name || typeof name !== 'string') return null

    const normalized = name.trim()
    if (normalized.length === 0) return null

    // try to find existing by case-insensitive match
    const found = usersRef.current.find((u) => u.name.toLowerCase() === normalized.toLowerCase())
    if (found) {
      setCurrentUserId(found.id)
      return found
    }

    // create new user
    const created = makeUser(normalized)
    setUsers((prev) => [...prev, created])
    setCurrentUserId(created.id)
    return created
  }

  const loginWithGoogle = (profile) => {
    // profile should include: sub (id), email, name
    if (!profile || !profile.sub) return null

    // find by googleId first, then email
    const foundByGoogle = usersRef.current.find((u) => u.googleId === profile.sub)
    if (foundByGoogle) {
      setCurrentUserId(foundByGoogle.id)
      return foundByGoogle
    }

    const foundByEmail = profile.email
      ? usersRef.current.find((u) => u.email && u.email.toLowerCase() === profile.email.toLowerCase())
      : null

    if (foundByEmail) {
      // attach google id if missing
      if (!foundByEmail.googleId) updateUser(foundByEmail.id, { googleId: profile.sub })
      setCurrentUserId(foundByEmail.id)
      return foundByEmail
    }

    // create a new user using google profile info
    const created = makeUser(profile.name || profile.email || 'Player', { email: profile.email, googleId: profile.sub })
    setUsers((prev) => [...prev, created])
    setCurrentUserId(created.id)
    return created
  }

  const logout = () => {
    setCurrentUserId(null)
  }

  const placeBet = (amount) => {
    const user = currentUser
    if (!user) return false

    if (!Number.isFinite(amount) || amount <= 0) return false

    if (amount > user.balance) return false

    const next = sanitizeBalance(user.balance - amount)
    updateUser(user.id, { balance: next })
    return true
  }

  const payout = (amount) => {
    const user = currentUser
    if (!user) return

    if (!Number.isFinite(amount) || amount < 0) return

    const next = sanitizeBalance(user.balance + amount)
    updateUser(user.id, { balance: next })
  }

  const resetBankroll = () => {
    const user = currentUser
    if (!user) return
    updateUser(user.id, { balance: STARTING_BANKROLL })
  }

  // Admin helpers
  const setBalanceForUser = (userId, amount) => {
    const user = getUserById(userId)
    if (!user) return false
    if (!Number.isFinite(amount) || amount < 0) return false
    updateUser(userId, { balance: sanitizeBalance(amount) })
    return true
  }

  const adjustBalanceForUser = (userId, delta) => {
    const user = getUserById(userId)
    if (!user) return false
    if (!Number.isFinite(delta)) return false
    const next = sanitizeBalance(user.balance + delta)
    updateUser(userId, { balance: next })
    return true
  }

  const getLeaderboard = () => {
    return [...users].sort((a, b) => b.balance - a.balance)
  }

  const createUser = (name, opts = {}) => {
    const created = makeUser(name, opts)
    setUsers((prev) => [...prev, created])
    return created
  }

  const value = {
    users,
    currentUserId,
    currentUser,
    // Backwards compatibility: expose top-level balance like before
    balance: currentUser?.balance ?? 0,
    login,
    loginWithGoogle,
    // allow consumers to request a fresh copy of profiles from the sheet-backed server
    fetchRemoteProfiles,
    logout,
    placeBet,
    payout,
    resetBankroll,
    startingBankroll: STARTING_BANKROLL,
    // admin APIs
    setBalanceForUser,
    adjustBalanceForUser,
    getLeaderboard,
    createUser,
  }

  return <BankrollContext.Provider value={value}>{children}</BankrollContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBankroll() {
  const context = useContext(BankrollContext)

  if (!context) {
    throw new Error('useBankroll must be used inside BankrollProvider')
  }

  return context
}
