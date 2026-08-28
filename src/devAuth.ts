/**
 * Local-development sign-in shortcut.
 *
 * The app decides who is admin by decoding the `email` claim out of a Google ID
 * token client-side — it never verifies the signature, because it does not need
 * to: the real boundary is server-side. Every write goes to the Apps Script Web
 * App, which re-checks the token against Google's `tokeninfo` endpoint and its
 * own allow-list before touching a sheet. A token minted here therefore unlocks
 * the dashboard *UI* and nothing else; saves still fail with "Invalid token".
 *
 * That makes it safe to hand yourself an admin session locally so the private
 * pages can be worked on without configuring OAuth first.
 *
 * Everything here is behind `import.meta.env.DEV`, which Vite replaces with the
 * literal `false` in a production build — the calls below are then dead code and
 * are dropped from the bundle.
 */

function toBase64Url(value: object) {
  return window
    .btoa(JSON.stringify(value))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

/** An unsigned JWT carrying just the claims this app reads: `email` and `exp`. */
export function makeDevIdToken(email: string, hoursValid = 12) {
  const header = { alg: 'none', typ: 'JWT' }
  const payload = {
    email,
    exp: Math.floor(Date.now() / 1000) + hoursValid * 3600,
  }

  return `${toBase64Url(header)}.${toBase64Url(payload)}.dev-not-a-real-signature`
}

/** Accounts offered by the dev sign-in buttons, mirroring ADMIN_GOOGLE_EMAILS. */
export const DEV_SIGN_IN_ACCOUNTS = [
  { label: 'Abe (full admin)', email: 'pasionabe@gmail.com' },
  { label: 'Ciara (admin, no Todoist writes)', email: 'pixielee1000@gmail.com' },
  { label: 'Someone else (guest)', email: 'guest@example.com' },
]
