import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'

/**
 * A PIN screen in front of the finance dashboard.
 *
 * **This is a privacy screen, not a security boundary, and it cannot be one.**
 * The site is static, so `VITE_FINANCE_PIN` is compiled into the public bundle
 * like every other `VITE_*` value, and four digits is 10,000 guesses regardless.
 * What it actually buys: someone glancing over your shoulder, or picking up an
 * unlocked phone, does not land on your balances.
 *
 * Making it real would mean moving the finance reads behind the authenticated
 * Apps Script or the Worker and checking the PIN server-side — the sheet is
 * currently readable with the public API key anyway.
 *
 * Unlocking lives in component state on purpose. React Router unmounts the
 * route on navigation, so leaving the page and coming back re-locks it with no
 * extra bookkeeping — which is exactly the asked-for behaviour.
 */

const PIN_LENGTH = 4
const MAX_ATTEMPTS = 5
const COOLDOWN_SECONDS = 30

/* Not exported: a non-component export here breaks fast refresh for the file. */
function getFinancePin() {
  const pin = import.meta.env.VITE_FINANCE_PIN?.trim()
  return pin && /^\d+$/.test(pin) ? pin : ''
}

export function FinancePinGate({ children }: { children: ReactNode }) {
  const expected = getFinancePin()
  // No PIN configured means nothing to check. Failing closed here would lock
  // the page with no way to open it, which is worse than not screening it.
  const [isUnlocked, setIsUnlocked] = useState(() => !expected)

  const [entry, setEntry] = useState('')
  const [error, setError] = useState('')
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

  useEffect(() => {
    if (!isUnlocked && cooldown === 0) {
      inputRef.current?.focus()
    }
  }, [isUnlocked, cooldown])

  if (isUnlocked) {
    return <>{children}</>
  }

  function submit(value: string) {
    if (value === expected) {
      setIsUnlocked(true)
      setEntry('')
      setError('')
      return
    }

    const next = attempts + 1
    setAttempts(next)
    setEntry('')

    if (next >= MAX_ATTEMPTS) {
      setCooldown(COOLDOWN_SECONDS)
      setError(`Too many attempts. Wait ${COOLDOWN_SECONDS} seconds.`)
      return
    }

    setError(`Incorrect PIN. ${MAX_ATTEMPTS - next} ${MAX_ATTEMPTS - next === 1 ? 'try' : 'tries'} left.`)
  }

  function handleChange(raw: string) {
    if (cooldown > 0) return

    const digits = raw.replace(/\D/g, '').slice(0, PIN_LENGTH)
    setEntry(digits)
    if (error && digits.length > 0) {
      setError('')
    }

    // Check on the last digit so there is nothing to press.
    if (digits.length === PIN_LENGTH) {
      submit(digits)
    }
  }

  return (
    <article className="info-card admin-card finance-lock">
      <div className="finance-lock-icon" aria-hidden="true">
        <Lock size={22} strokeWidth={1.7} />
      </div>

      <h3>Finances are locked</h3>
      <p className="sheets-meta">
        Enter your {PIN_LENGTH}-digit PIN. The page locks again whenever you navigate away.
      </p>

      <form
        className="finance-lock-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (entry.length === PIN_LENGTH) submit(entry)
        }}
      >
        <label className="sr-only" htmlFor="finance-pin">
          Finance PIN
        </label>
        <input
          id="finance-pin"
          ref={inputRef}
          className="finance-lock-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          // Keeps password managers from offering to save four digits.
          data-1p-ignore
          maxLength={PIN_LENGTH}
          value={entry}
          disabled={cooldown > 0}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'finance-pin-error' : undefined}
          onChange={(event) => handleChange(event.target.value)}
        />
      </form>

      {/* Announced rather than only shown, so the reason is not lost on a
          screen reader mid-entry. */}
      <p
        id="finance-pin-error"
        className={`finance-lock-error${error ? '' : ' is-empty'}`}
        role="status"
        aria-live="polite"
      >
        {cooldown > 0 ? `Too many attempts. Wait ${cooldown}s.` : error}
      </p>
    </article>
  )
}
