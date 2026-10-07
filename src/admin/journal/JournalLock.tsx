import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Lock } from 'lucide-react'

/**
 * A password screen in front of the journal's past entries. Writing a new entry
 * stays open; only reading them back is behind it.
 *
 * **This is a privacy screen, not a security boundary.** Journal reads already
 * need the admin's sign-in on the db Worker; this only stops someone holding an
 * unlocked, signed-in device from reading back what you wrote. The entries are
 * still fetched before unlock, because the mood card charts them.
 *
 * The bundle carries a SHA-256 of the password, never the password, since every
 * `VITE_*` value is public. A hash is still guessable offline, so this should
 * not be a password used anywhere else.
 *
 * Unlocking lives in component state on purpose: leaving the page unmounts it,
 * so coming back re-locks with no extra bookkeeping.
 */

const MAX_ATTEMPTS = 5
const COOLDOWN_SECONDS = 30

/* Not exported: a non-component export here breaks fast refresh for the file. */
function getPasswordHash() {
  const hash = import.meta.env.VITE_JOURNAL_PASSWORD_SHA256?.trim().toLowerCase()
  return hash && /^[0-9a-f]{64}$/.test(hash) ? hash : ''
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function JournalLock({ children }: { children: ReactNode }) {
  const expected = getPasswordHash()
  // No hash configured means nothing to check. Failing closed would hide the
  // entries with no way to reach them, which is worse than not screening them.
  const [isUnlocked, setIsUnlocked] = useState(() => !expected)

  const [entry, setEntry] = useState('')
  const [error, setError] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [cooldown, setCooldown] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (cooldown <= 0) return

    const id = window.setInterval(() => {
      setCooldown((value) => {
        if (value <= 1) {
          setAttempts(0)
          setError('')
          return 0
        }
        return value - 1
      })
    }, 1000)

    return () => window.clearInterval(id)
  }, [cooldown])

  if (isUnlocked) {
    return <>{children}</>
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!entry || isChecking || cooldown > 0) return

    setIsChecking(true)
    const matches = (await sha256Hex(entry)) === expected
    setIsChecking(false)

    if (matches) {
      setIsUnlocked(true)
      setEntry('')
      setError('')
      return
    }

    const next = attempts + 1
    setAttempts(next)
    setEntry('')
    inputRef.current?.focus()

    if (next >= MAX_ATTEMPTS) {
      setCooldown(COOLDOWN_SECONDS)
      setError(`Too many attempts. Wait ${COOLDOWN_SECONDS} seconds.`)
      return
    }

    setError(`Incorrect password. ${MAX_ATTEMPTS - next} ${MAX_ATTEMPTS - next === 1 ? 'try' : 'tries'} left.`)
  }

  return (
    <div className="journal-lock">
      <div className="journal-lock-icon" aria-hidden="true">
        <Lock size={20} strokeWidth={1.7} />
      </div>

      <h4>Entries are locked</h4>
      <p className="sheets-meta">
        Enter your journal password to read past entries. It locks again when you leave this page.
      </p>

      <form className="journal-lock-form" onSubmit={submit}>
        <label className="sr-only" htmlFor="journal-password">
          Journal password
        </label>
        <input
          id="journal-password"
          ref={inputRef}
          type="password"
          autoComplete="current-password"
          value={entry}
          disabled={cooldown > 0}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'journal-password-error' : undefined}
          onChange={(event) => {
            setEntry(event.target.value)
            if (error && cooldown === 0) setError('')
          }}
        />
        <button type="submit" disabled={!entry || isChecking || cooldown > 0}>
          Unlock
        </button>
      </form>

      {/* Announced rather than only shown, so the reason is not lost on a
          screen reader mid-entry. */}
      <p
        id="journal-password-error"
        className={`journal-lock-error${error ? '' : ' is-empty'}`}
        role="status"
        aria-live="polite"
      >
        {cooldown > 0 ? `Too many attempts. Wait ${cooldown}s.` : error}
      </p>
    </div>
  )
}
