import { useEffect, useState } from 'react'
import { Archive, PenLine, ExternalLink } from 'lucide-react'
import { ConnectPanel } from './ConnectPanel'
import {
  archiveMail,
  createDraftReply,
  getMail,
  type MailSummaryRecord,
} from '../data/sheets/repositories'
import type { ConnectionStatus } from './integrations/types'
import { REPLY_TEMPLATES, fillTemplate, senderFirstName } from './mail/replyTemplates'

/**
 * Threads fetched in one go — the Apps Script caps `getMail` at 25. The list
 * shows three at a time and scrolls through the rest (see `.mail-list`).
 */
const FETCH_LIMIT = 25

function timeLabel(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/**
 * Mail is read and acted on by the Apps Script Web App, which runs as the
 * account that owns it and re-verifies the admin ID token first. That keeps
 * Gmail scopes off the site's OAuth client entirely.
 *
 * The script holds `gmail.modify` and `gmail.compose` — enough to archive and
 * to save drafts. It deliberately has no send capability: drafts are finished
 * and sent in Gmail.
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
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(status.state === 'connected')
  const [busyId, setBusyId] = useState('')
  /** Thread the reply-template picker is open for. */
  const [composingId, setComposingId] = useState('')

  async function load() {
    try {
      const rows = await getMail(idToken, FETCH_LIMIT)
      setMail(rows)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load mail')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (status.state !== 'connected') {
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const rows = await getMail(idToken, FETCH_LIMIT)
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

  async function handleArchive(message: MailSummaryRecord) {
    if (busyId) return

    setBusyId(message.threadId)
    setError('')
    setNotice('')

    // Optimistic: archiving is recoverable, so show the result immediately.
    const previous = mail
    setMail((rows) => rows.filter((row) => row.threadId !== message.threadId))

    try {
      const result = await archiveMail(idToken, [message.threadId])
      if (!result.archived.includes(message.threadId)) {
        throw new Error('Gmail did not archive that thread.')
      }
      setNotice('Archived. Still in All Mail if you need it back.')
    } catch (caught) {
      setMail(previous)
      setError(caught instanceof Error ? caught.message : 'Unable to archive')
    } finally {
      setBusyId('')
    }
  }

  async function handleArchiveAll() {
    if (busyId || mail.length === 0) return

    const ids = mail.map((row) => row.threadId)
    setBusyId('all')
    setError('')
    setNotice('')

    const previous = mail
    setMail([])

    try {
      const result = await archiveMail(idToken, ids)
      setNotice(
        `Archived ${result.archived.length} thread${result.archived.length === 1 ? '' : 's'}.` +
          (result.failed.length ? ` ${result.failed.length} could not be archived.` : ''),
      )
      if (result.failed.length) {
        await load()
      }
    } catch (caught) {
      setMail(previous)
      setError(caught instanceof Error ? caught.message : 'Unable to archive')
    } finally {
      setBusyId('')
    }
  }

  async function handleDraft(message: MailSummaryRecord, templateId: string) {
    const template = REPLY_TEMPLATES.find((item) => item.id === templateId)
    if (!template || busyId) return

    setBusyId(message.threadId)
    setError('')
    setNotice('')
    setComposingId('')

    try {
      const result = await createDraftReply(
        idToken,
        message.threadId,
        fillTemplate(template, message.from),
      )
      setNotice(
        result.permalink
          ? 'Draft saved to Gmail — open the thread to edit and send.'
          : 'Draft saved to Gmail.',
      )
      if (result.permalink) {
        window.open(result.permalink, '_blank', 'noopener,noreferrer')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create draft')
    } finally {
      setBusyId('')
    }
  }

  const unreadCount = mail.filter((message) => message.unread).length
  // Gone once its thread is archived, which closes the picker with it.
  const composingMessage = mail.find((message) => message.threadId === composingId)

  return (
    <article className="info-card admin-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        <div className="admin-card-actions">
          {status.state === 'connected' && !isLoading && !error ? (
            <span className="admin-pill">{unreadCount} unread</span>
          ) : null}
          {status.state === 'connected' && mail.length > 0 ? (
            <button
              type="button"
              className="secondary-action"
              onClick={handleArchiveAll}
              disabled={Boolean(busyId)}
            >
              {busyId === 'all' ? 'Clearing…' : 'Clear inbox'}
            </button>
          ) : null}
        </div>
      </div>

      {status.state !== 'connected' ? (
        <ConnectPanel name="Gmail" status={status} />
      ) : isLoading ? (
        <p className="sheets-meta">Loading mail…</p>
      ) : error && mail.length === 0 ? (
        <p className="sheets-meta">{error}</p>
      ) : (
        <>
          {/* An action failure sits above the list so the inbox stays usable and
              the row that would not archive is still there to retry. */}
          {error ? (
            <p className="sheets-meta mail-notice is-error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? <p className="sheets-meta mail-notice">{notice}</p> : null}

          {mail.length === 0 ? (
            <p className="sheets-meta">Inbox is empty.</p>
          ) : (
            <ul className="mail-list" aria-label="Inbox threads">
              {mail.map((message) => (
                <li key={message.id} className={`mail-row ${message.unread ? 'unread' : ''}`}>
                  <div className="mail-row-text">
                    <div className="mail-row-head">
                      <span className="mail-from">{senderFirstName(message.from)}</span>
                      <span className="mail-time">{timeLabel(message.receivedAt)}</span>
                    </div>

                    {/* One line each, cut with an ellipsis: every row is the same
                        height, so the list always shows exactly three. */}
                    <p className="mail-subject" title={message.subject || undefined}>
                      {message.important ? (
                        <span className="mail-flag" aria-label="Important">
                          !
                        </span>
                      ) : null}
                      {message.subject || '(no subject)'}
                    </p>

                    <p className="mail-snippet">{message.snippet}</p>
                  </div>

                  <div className="mail-actions">
                    <button
                      type="button"
                      className="mail-action"
                      onClick={() => handleArchive(message)}
                      disabled={Boolean(busyId)}
                      aria-label="Archive"
                      title="Archive — stays in All Mail"
                    >
                      <Archive size={15} strokeWidth={1.8} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      className={`mail-action${composingId === message.threadId ? ' is-active' : ''}`}
                      onClick={() =>
                        setComposingId(composingId === message.threadId ? '' : message.threadId)
                      }
                      disabled={Boolean(busyId)}
                      aria-label="Draft reply"
                      title="Draft reply"
                      aria-expanded={composingId === message.threadId}
                      aria-controls={composingId === message.threadId ? 'mail-reply-templates' : undefined}
                    >
                      <PenLine size={15} strokeWidth={1.8} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Below the list rather than inside the row, so opening it never
              breaks the fixed row height. */}
          {composingMessage ? (
            <div
              id="mail-reply-templates"
              className="mail-templates"
              role="group"
              aria-label={`Reply templates for ${senderFirstName(composingMessage.from)}`}
            >
              <p className="mail-templates-title">
                Reply to {senderFirstName(composingMessage.from)}
                <span>{composingMessage.subject || '(no subject)'}</span>
              </p>
              {REPLY_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleDraft(composingMessage, template.id)}
                  disabled={Boolean(busyId)}
                >
                  {template.label}
                </button>
              ))}
              <p className="sheets-meta">
                Saves a draft in Gmail and opens the thread. Nothing is sent from here.
              </p>
            </div>
          ) : null}

          <a
            href="https://mail.google.com/mail/u/0/#inbox"
            target="_blank"
            rel="noreferrer"
            className="mail-open-gmail"
          >
            <ExternalLink size={13} strokeWidth={1.8} aria-hidden="true" />
            <span>Open Gmail</span>
          </a>
        </>
      )}
    </article>
  )
}
