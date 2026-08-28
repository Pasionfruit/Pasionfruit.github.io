import type { ConnectionStatus, MailSummary } from './types'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

/**
 * Gmail reads need an OAuth *access* token with the `gmail.readonly` scope.
 * The site's Google Sign-In only produces an *ID* token (identity, no API
 * scopes), so until that scope is added to the OAuth consent screen and a
 * token flow is wired up, this reports `needs-auth` and the dashboard renders
 * a connect panel rather than a misleading empty inbox.
 */
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'

const ACCESS_TOKEN_KEY = 'gmail-access-token'

export function readGmailAccessToken(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY) ?? ''
  } catch {
    return ''
  }
}

export function getGmailStatus(): ConnectionStatus {
  const clientConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim())

  if (!clientConfigured) {
    return {
      state: 'not-configured',
      message: 'No Google OAuth client is configured for this build.',
      steps: ['Set VITE_GOOGLE_CLIENT_ID in .env and in the GitHub Actions build environment.'],
    }
  }

  if (!readGmailAccessToken()) {
    return {
      state: 'needs-auth',
      message: 'Signed in, but this session has no Gmail read scope.',
      steps: [
        `Add the ${GMAIL_SCOPE} scope to the OAuth consent screen for this client.`,
        'Grant the scope through an OAuth token flow so an access token is issued.',
        'Mail then loads here automatically — nothing is ever sent or archived from this page.',
      ],
    }
  }

  return {
    state: 'connected',
    message: 'Reading the most recent mail in your inbox.',
    steps: [],
  }
}

type GmailListResponse = {
  messages?: { id: string; threadId: string }[]
}

type GmailMessageResponse = {
  id: string
  threadId: string
  snippet?: string
  internalDate?: string
  labelIds?: string[]
  payload?: { headers?: { name: string; value: string }[] }
}

function header(message: GmailMessageResponse, name: string) {
  const match = message.payload?.headers?.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  )
  return match?.value ?? ''
}

async function gmailRequest<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(
      response.status === 401 || response.status === 403
        ? 'Gmail rejected the access token. Re-grant the gmail.readonly scope.'
        : `Gmail request failed: ${response.status}`,
    )
  }

  return response.json() as Promise<T>
}

/**
 * The newest messages in the inbox, metadata only — the message body is never
 * requested, so nothing beyond sender, subject, and Gmail's own snippet is
 * pulled into the browser.
 */
export async function getRecentMail(accessToken: string, limit = 12): Promise<MailSummary[]> {
  const list = await gmailRequest<GmailListResponse>(
    `/messages?maxResults=${limit}&labelIds=INBOX`,
    accessToken,
  )

  const ids = list.messages ?? []

  const messages = await Promise.all(
    ids.map((entry) =>
      gmailRequest<GmailMessageResponse>(
        `/messages/${entry.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        accessToken,
      ),
    ),
  )

  return messages.map((message) => ({
    id: message.id,
    threadId: message.threadId,
    from: header(message, 'From'),
    subject: header(message, 'Subject') || '(no subject)',
    snippet: message.snippet ?? '',
    receivedAt: message.internalDate
      ? new Date(Number(message.internalDate)).toISOString()
      : new Date().toISOString(),
    unread: message.labelIds?.includes('UNREAD') ?? false,
    important: message.labelIds?.includes('IMPORTANT') ?? false,
  }))
}
