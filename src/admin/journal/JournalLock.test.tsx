// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JournalLock } from './JournalLock'

const ENTRIES = 'past entries'
const PASSWORD = 'correct horse'
// Generated outside the app (Node's crypto), so a hashing bug cannot agree with itself.
const PASSWORD_HASH = '4104d36f8da2c254349f85836793ebe029e0c957063a34c91c2e9203187b5631'

function renderLock() {
  return render(
    <JournalLock>
      <p>{ENTRIES}</p>
    </JournalLock>,
  )
}

function passwordField() {
  return screen.getByLabelText('Journal password')
}

async function tryPassword(user: ReturnType<typeof userEvent.setup>, value: string) {
  await user.type(passwordField(), value)
  await user.click(screen.getByRole('button', { name: 'Unlock' }))
}

beforeEach(() => {
  vi.unstubAllEnvs()
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('JournalLock', () => {
  it('lets the entries through when no password is configured', () => {
    vi.stubEnv('VITE_JOURNAL_PASSWORD_SHA256', '')
    renderLock()

    // Failing closed would hide the entries with no way to reach them.
    expect(screen.getByText(ENTRIES)).toBeTruthy()
  })

  it('ignores a value that is not a SHA-256 digest rather than locking for good', () => {
    // The plain password pasted in by mistake can never match its own hash.
    vi.stubEnv('VITE_JOURNAL_PASSWORD_SHA256', PASSWORD)
    renderLock()

    expect(screen.getByText(ENTRIES)).toBeTruthy()
  })

  it('hides the entries behind the prompt when a password is set', () => {
    vi.stubEnv('VITE_JOURNAL_PASSWORD_SHA256', PASSWORD_HASH)
    renderLock()

    expect(screen.queryByText(ENTRIES)).toBeNull()
    expect(screen.getByRole('heading', { name: 'Entries are locked' })).toBeTruthy()
  })

  it('unlocks with the right password', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_JOURNAL_PASSWORD_SHA256', PASSWORD_HASH)
    renderLock()

    await tryPassword(user, PASSWORD)

    expect(await screen.findByText(ENTRIES)).toBeTruthy()
  })

  it('accepts the digest in upper case, as some tools print it', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_JOURNAL_PASSWORD_SHA256', PASSWORD_HASH.toUpperCase())
    renderLock()

    await tryPassword(user, PASSWORD)

    expect(await screen.findByText(ENTRIES)).toBeTruthy()
  })

  it('rejects a wrong password, clears it, and counts down the tries', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_JOURNAL_PASSWORD_SHA256', PASSWORD_HASH)
    renderLock()

    await tryPassword(user, 'wrong')

    expect(await screen.findByText('Incorrect password. 4 tries left.')).toBeTruthy()
    expect(screen.queryByText(ENTRIES)).toBeNull()
    expect((passwordField() as HTMLInputElement).value).toBe('')
  })

  it('locks the field for a cooldown after five wrong passwords', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_JOURNAL_PASSWORD_SHA256', PASSWORD_HASH)
    renderLock()

    // Each check is async, so wait for its verdict before typing the next.
    for (let left = 4; left >= 1; left -= 1) {
      await tryPassword(user, `wrong-${left}`)
      await screen.findByText(`Incorrect password. ${left} ${left === 1 ? 'try' : 'tries'} left.`)
    }
    await tryPassword(user, 'wrong-last')

    expect(await screen.findByText(/Too many attempts/)).toBeTruthy()
    expect((passwordField() as HTMLInputElement).disabled).toBe(true)
  })

  it('locks again when remounted, as leaving the page does', async () => {
    const user = userEvent.setup()
    vi.stubEnv('VITE_JOURNAL_PASSWORD_SHA256', PASSWORD_HASH)
    const { unmount } = renderLock()

    await tryPassword(user, PASSWORD)
    await screen.findByText(ENTRIES)

    unmount()
    renderLock()

    expect(screen.queryByText(ENTRIES)).toBeNull()
  })
})
