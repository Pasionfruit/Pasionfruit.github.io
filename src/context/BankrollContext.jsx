import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { apiFetch, apiJson } from '../lib/apiClient'

const STARTING_BANKROLL = 1000
const USERS_KEY = 'casino-users'
const CURRENT_USER_KEY = 'casino-current-user'
const LEGACY_KEY = 'casino-shared-bankroll'
const REMOTE_ONLY_MODE = Boolean((import.meta.env.VITE_API_BASE_URL || '').trim())
const IS_TEST_MODE = import.meta.env.MODE === 'test'
const AUTH_PROVIDER_LOCAL = 'local'
const AUTH_PROVIDER_GOOGLE = 'google'
const AUTH_PROVIDER_LINKED = 'linked'

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
    passwordHash: opts.passwordHash || null,
    authProvider: opts.authProvider || AUTH_PROVIDER_LOCAL,
    sheetRowIndex: Number.isFinite(opts.sheetRowIndex) ? opts.sheetRowIndex : null,
  }
}

async function hashPassword(password) {
  const normalized = String(password || '')

  if (globalThis.crypto?.subtle && globalThis.TextEncoder) {
    const encoded = new TextEncoder().encode(normalized)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded)
    const bytes = Array.from(new Uint8Array(digest))
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // Fallback for older environments.
  try {
    return btoa(unescape(encodeURIComponent(normalized)))
  } catch {
    return normalized
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

  const [currentUserId, setCurrentUserId] = useState(() => readCurrentUserIdFromStorage() || (IS_TEST_MODE ? (users[0]?.id || null) : null))

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
      const resp = await apiFetch('/profiles')
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
        passwordHash: r.passwordHash || null,
        authProvider: r.authProvider || AUTH_PROVIDER_LOCAL,
        googleId: r.googleId || null,
        sheetRowIndex: Number(r.rowIndex) || null,
      }))

      // Preserve local users that have not been synced to a sheet row yet.
      const remoteKeys = new Set(mapped.flatMap((u) => {
        const keys = []
        if (u.googleId) keys.push(`gid:${String(u.googleId).toLowerCase()}`)
        if (u.email) keys.push(`email:${String(u.email).toLowerCase()}`)
        if (u.name) keys.push(`name:${String(u.name).toLowerCase()}`)
        return keys
      }))

      const localUnsynced = usersRef.current.filter((u) => !u.sheetRowIndex)
      const localOnly = localUnsynced.filter((u) => {
        const keys = []
        if (u.googleId) keys.push(`gid:${String(u.googleId).toLowerCase()}`)
        if (u.email) keys.push(`email:${String(u.email).toLowerCase()}`)
        if (u.name) keys.push(`name:${String(u.name).toLowerCase()}`)
        if (keys.length === 0) return true
        return !keys.some((k) => remoteKeys.has(k))
      })

      const merged = [...mapped, ...localOnly]

      // If any of the sheet rows have the name 'Admin' (case-insensitive), mark as admin
      merged.forEach((u) => {
        if (u.name && u.name.toLowerCase() === 'admin') u.isAdmin = true
      })

      const previousCurrent = usersRef.current.find((u) => u.id === currentUserId) || null
      const sameId = currentUserId ? merged.find((u) => u.id === currentUserId) : null
      const sameEmail = previousCurrent?.email
        ? merged.find((u) => u.email && u.email.toLowerCase() === previousCurrent.email.toLowerCase())
        : null
      const sameName = previousCurrent?.name
        ? merged.find((u) => u.name && u.name.toLowerCase() === previousCurrent.name.toLowerCase())
        : null
      const nextCurrent = sameId || sameEmail || sameName || null

      setUsers(merged)
      setCurrentUserId(nextCurrent?.id ?? null)
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

  const syncUserToRemote = async (user) => {
    if (!user) return false

    try {
      if (user.sheetRowIndex) {
        const updateResp = await apiJson(`/profiles/${user.sheetRowIndex}`, {
          method: 'PUT',
          body: {
            name: user.name,
            email: user.email || '',
            balance: sanitizeBalance(user.balance),
            passwordHash: user.passwordHash || '',
            authProvider: user.authProvider || AUTH_PROVIDER_LOCAL,
            googleId: user.googleId || '',
          },
        })
        if (!updateResp.ok) return false
        const updatedBody = await updateResp.json().catch(() => ({}))
        if (updatedBody?.error) return false
        return true
      }

      const createResp = await apiJson('/profiles', {
        method: 'POST',
        body: {
          name: user.name,
          email: user.email || '',
          balance: sanitizeBalance(user.balance),
          passwordHash: user.passwordHash || '',
          authProvider: user.authProvider || AUTH_PROVIDER_LOCAL,
          googleId: user.googleId || '',
        },
      })

      if (!createResp.ok) return false
      const created = await createResp.json().catch(() => ({}))
      if (created?.error) return false
      const rowIndex = Number(created?.rowIndex)
      if (!Number.isFinite(rowIndex)) return false

      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, sheetRowIndex: rowIndex } : u)))
      return true
    } catch {
      return false
    }
  }

  // currentUser derived from state for safe render-time access
  const currentUser = users.find((u) => u.id === currentUserId) || null

  const updateUser = (id, patch, opts = {}) => {
    const { syncRemote = true } = opts
    let nextUser = null

    setUsers((prev) => prev.map((u) => {
      if (u.id !== id) return u
      nextUser = { ...u, ...patch }
      return nextUser
    }))

    if (syncRemote && nextUser) {
      void syncUserToRemote(nextUser)
    }
  }

  const login = async (name, password) => {
    if (!name || typeof name !== 'string') return null

    if (!password || typeof password !== 'string' || password.trim().length === 0) return null

    const normalized = name.trim()
    if (normalized.length === 0) return null

    // try to find existing by case-insensitive match
    const found = usersRef.current.find((u) => u.name.toLowerCase() === normalized.toLowerCase())
    if (found) {
      if (!found.passwordHash) {
        // Accounts without a password hash are Google-only accounts.
        return null
      }

      const incomingHash = await hashPassword(password)
      if (incomingHash !== found.passwordHash) return null

      setCurrentUserId(found.id)
      return found
    }

    // create new user
    const passwordHash = await hashPassword(password)
    const created = makeUser(normalized, {
      passwordHash,
      authProvider: AUTH_PROVIDER_LOCAL,
    })
    setUsers((prev) => [...prev, created])
    setCurrentUserId(created.id)
    void syncUserToRemote(created)
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
      // attach google id if missing and mark as linked provider
      if (!foundByEmail.googleId) {
        updateUser(foundByEmail.id, {
          googleId: profile.sub,
          authProvider: foundByEmail.passwordHash ? AUTH_PROVIDER_LINKED : AUTH_PROVIDER_GOOGLE,
        })
      }
      setCurrentUserId(foundByEmail.id)
      return foundByEmail
    }

    // create a new user using google profile info
    const created = makeUser(profile.name || profile.email || 'Player', {
      email: profile.email,
      googleId: profile.sub,
      authProvider: AUTH_PROVIDER_GOOGLE,
      passwordHash: null,
    })
    setUsers((prev) => [...prev, created])
    setCurrentUserId(created.id)
    void syncUserToRemote(created)
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
    void syncUserToRemote(created)
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
