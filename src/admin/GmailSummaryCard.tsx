import { useEffect, useState } from 'react'
import { ConnectPanel } from './ConnectPanel'
import { getMail, type MailSummaryRecord } from '../data/sheets/repositories'
import type { ConnectionStatus } from './integrations/types'

function senderName(from: string) {
  const match = /^\s*"?([^"<]*)"?\s*</.exec(from)
  const name = match?.[1]?.trim()
  if (name) {
    return name
  }

  return from.replace(/[<>]/g, '').trim() || 'Unknown sender'
}

function timeLabel(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/**
 * Mail is read by the Apps Script Web App, which runs as the account that owns
 * it and re-verifies the admin ID token before touching the mailbox. That keeps
 * Gmail scopes off the site's OAuth client entirely — nothing here needs an
 * access token, and no Gmail permission is ever requested in the browser.
 */
function getStatus(idToken: string): ConnectionStatus {
  if (!import.meta.env.VITE_SHEETS_API_BASE_URL?.trim()) {
    return {
      state: 'not-configured',
      message: 'No Apps Script endpoint is configured for this build.',
      steps: ['Set VITE_SHEETS_API_BASE_URL to your deployed Apps Script Web App URL.'],
    }
  }

  if (!idToken) {
    return {
      state: 'needs-auth',
      message: 'Sign in with the admin Google account to read mail.',
      steps: ['Open /login and sign in.'],
    }
  }

  return { state: 'connected', message: 'Reading the most recent mail in your inbox.', steps: [] }
}

export function GmailSummaryCard({ title, idToken }: { title: string; idToken: string }) {
  const status = getStatus(idToken)
  const [mail, setMail] = useState<MailSummaryRecord[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(status.state === 'connected')

  useEffect(() => {
    if (status.state !== 'connected') {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const rows = await getMail(idToken)
        if (!cancelled) {
          setMail(rows)
          setError('')
        }
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : 'Unable to load mail')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status.state, idToken])

  const unreadCount = mail.filter((message) => message.unread).length

  return (
    <article className="info-card admin-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        {status.state === 'connected' && !isLoading && !error ? (
          <span className="admin-pill">{unreadCount} unread</span>
        ) : null}
      </div>

      {status.state !== 'connected' ? (
        <ConnectPanel name="Gmail" status={status} />
      ) : isLoading ? (
        <p className="sheets-meta">Loading mail…</p>
      ) : error ? (
        <p className="sheets-meta">{error}</p>
      ) : mail.length === 0 ? (
        <p className="sheets-meta">Inbox is empty.</p>
      ) : (
        <ul className="mail-list">
          {mail.map((message) => (
            <li key={message.id} className={`mail-row ${message.unread ? 'unread' : ''}`}>
              <div className="mail-row-head">
                <span className="mail-from">{senderName(message.from)}</span>
                <span className="mail-time">{timeLabel(message.receivedAt)}</span>
              </div>
              <p className="mail-subject">
                {message.important ? <span className="mail-flag" aria-label="Important">!</span> : null}
                {message.subject || '(no subject)'}
              </p>
              <p className="mail-snippet">{message.snippet}</p>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
