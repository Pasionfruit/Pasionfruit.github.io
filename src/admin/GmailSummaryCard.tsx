import { useEffect, useState } from 'react'
import { ConnectPanel } from './ConnectPanel'
import { getGmailStatus, getRecentMail, readGmailAccessToken } from './integrations/gmail'
import type { MailSummary } from './integrations/types'

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

export function GmailSummaryCard({ title }: { title: string }) {
  const status = getGmailStatus()
  const [mail, setMail] = useState<MailSummary[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(status.state === 'connected')

  useEffect(() => {
    if (status.state !== 'connected') {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const rows = await getRecentMail(readGmailAccessToken())
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
  }, [status.state])

  const unreadCount = mail.filter((message) => message.unread).length

  return (
    <article className="info-card admin-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        {status.state === 'connected' && !isLoading ? (
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
                {message.subject}
              </p>
              <p className="mail-snippet">{message.snippet}</p>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
