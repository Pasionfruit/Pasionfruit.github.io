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

/** Rows shown per page in the inbox list. */
const PAGE_SIZE = 5

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
  const [page, setPage] = useState(0)
  /** Thread the reply-template picker is open for. */
  const [composingId, setComposingId] = useState('')

  async function load() {
    try {
      const rows = await getMail(idToken, PAGE_SIZE * 5)
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
        const rows = await getMail(idToken, PAGE_SIZE * 5)
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
  const pageCount = Math.max(1, Math.ceil(mail.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const visibleMail = mail.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

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
            <ul className="mail-list">
              {visibleMail.map((message) => (
                <li key={message.id} className={`mail-row ${message.unread ? 'unread' : ''}`}>
                  <div className="mail-row-head">
                    <span className="mail-from">{senderFirstName(message.from)}</span>
                    <span className="mail-time">{timeLabel(message.receivedAt)}</span>
                  </div>

                  <p className="mail-subject">
                    {message.important ? (
                      <span className="mail-flag" aria-label="Important">
                        !
                      </span>
                    ) : null}
                    {message.subject || '(no subject)'}
                  </p>

                  <p className="mail-snippet">{message.snippet}</p>

                  <div className="mail-actions">
                    <button
                      type="button"
                      className="mail-action"
                      onClick={() => handleArchive(message)}
                      disabled={Boolean(busyId)}
                      title="Archive — stays in All Mail"
                    >
                      <Archive size={14} strokeWidth={1.8} aria-hidden="true" />
                      <span>Archive</span>
                    </button>

                    <button
                      type="button"
                      className="mail-action"
                      onClick={() =>
                        setComposingId(composingId === message.threadId ? '' : message.threadId)
                      }
                      disabled={Boolean(busyId)}
                      aria-expanded={composingId === message.threadId}
                    >
                      <PenLine size={14} strokeWidth={1.8} aria-hidden="true" />
                      <span>Draft reply</span>
                    </button>
                  </div>

                  {composingId === message.threadId ? (
                    <div className="mail-templates" role="group" aria-label="Reply templates">
                      {REPLY_TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => handleDraft(message, template.id)}
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
                </li>
              ))}
            </ul>
          )}

          {mail.length > PAGE_SIZE ? (
            <div className="mail-pager">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(0, value - 1))}
                disabled={safePage === 0}
              >
                ‹ Newer
              </button>
              <span className="sheets-meta">
                {safePage * PAGE_SIZE + 1}–{Math.min(mail.length, (safePage + 1) * PAGE_SIZE)} of{' '}
                {mail.length}
              </span>
              <button
                type="button"
                onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
                disabled={safePage >= pageCount - 1}
              >
                Older ›
              </button>
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
