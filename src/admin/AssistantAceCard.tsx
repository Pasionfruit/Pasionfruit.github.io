import { useEffect, useMemo, useRef, useState } from 'react'
import { Send, Sparkles, Plus, RefreshCw, X } from 'lucide-react'
import {
  aceChat,
  aceJson,
  getAceConfig,
  type AceMessage,
} from './ace/client'
import { buildAceContext, renderAceContext, type AceContext } from './ace/context'
import {
  ACE_SYSTEM_PROMPT,
  MORNING_REPORT_PROMPT,
  REMINDER_SCHEMA,
  reminderExtractionPrompt,
  type ReminderDraft,
} from './ace/prompts'
import { createTask } from '../data/todoist/repositories'
import { todayKey } from '../data/todoist/dates'

type ChatTurn = { id: string; role: 'user' | 'assistant'; content: string }

const BRIEFING_KEY = 'ace-briefing'

/** Briefings are per-day, so a stale one from yesterday is never shown. */
function readCachedBriefing(): string {
  try {
    const raw = localStorage.getItem(BRIEFING_KEY)
    if (!raw) return ''
    const parsed = JSON.parse(raw) as { day?: string; text?: string }
    return parsed.day === todayKey() ? parsed.text ?? '' : ''
  } catch {
    return ''
  }
}

function writeCachedBriefing(text: string) {
  try {
    localStorage.setItem(BRIEFING_KEY, JSON.stringify({ day: todayKey(), text }))
  } catch {
    // Private windows and blocked site data both throw; the briefing is a
    // convenience, so losing the cache is not worth surfacing.
  }
}

/**
 * Renders the model's markdown-ish output without pulling in a parser. Bold
 * runs, section headings and list items are all these prompts ask for, and a
 * markdown dependency for that would be a poor trade.
 */
function inlineBold(text: string, keyPrefix: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, index) => {
    const bold = /^\*\*([^*]+)\*\*$/.exec(part)
    return bold ? (
      <strong key={`${keyPrefix}-${index}`}>{bold[1]}</strong>
    ) : (
      <span key={`${keyPrefix}-${index}`}>{part}</span>
    )
  })
}

function AceMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {text.split('\n').map((line, index) => {
        const trimmed = line.trim()
        if (!trimmed) return null

        /*
         * A line opening with a bold run is a section heading, and the rest of
         * that line is its body — which must not inherit the heading's weight,
         * or every briefing section reads as a title with nothing under it.
         */
        const heading = /^\*\*(.+?)\*\*\s*(.*)$/.exec(trimmed)
        if (heading) {
          const body = heading[2].replace(/^[\s—–-]+/, '')
          return (
            <p key={index} className="ace-md-heading">
              <span className="ace-md-label">{heading[1]}</span>
              {body ? <span className="ace-md-rest">{inlineBold(body, `b${index}`)}</span> : null}
            </p>
          )
        }

        if (/^[-*]\s+/.test(trimmed)) {
          return (
            <p key={index} className="ace-md-item">
              {inlineBold(trimmed.replace(/^[-*]\s+/, ''), `i${index}`)}
            </p>
          )
        }

        return <p key={index}>{inlineBold(trimmed, `p${index}`)}</p>
      })}
    </div>
  )
}

/**
 * Assistant Ace: a briefing built from the day's real data, and a chat box to
 * the model running on Abe's own machine.
 *
 * The left pane works whether or not the model is reachable — the counts and
 * the yesterday recap are computed here, not generated — so the card degrades
 * to what the old Yesterday card showed rather than to nothing.
 */
export function AssistantAceCard({
  title,
  idToken,
  todoistConfigured,
}: {
  title: string
  idToken: string
  todoistConfigured: boolean
}) {
  const config = useMemo(() => getAceConfig(), [])

  const [context, setContext] = useState<AceContext | null>(null)
  const [contextError, setContextError] = useState('')

  const [briefing, setBriefing] = useState(readCachedBriefing)
  const [isBriefing, setIsBriefing] = useState(false)
  const [briefingError, setBriefingError] = useState('')

  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [draft, setDraft] = useState('')
  const [streaming, setStreaming] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [chatError, setChatError] = useState('')

  const [reminder, setReminder] = useState<ReminderDraft | null>(null)
  const [reminderNote, setReminderNote] = useState('')
  const [isSavingReminder, setIsSavingReminder] = useState(false)
  const [reminderNotice, setReminderNotice] = useState('')

  const abortRef = useRef<AbortController | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const next = await buildAceContext(idToken, todoistConfigured)
        if (!cancelled) {
          setContext(next)
          setContextError('')
        }
      } catch (caught) {
        if (!cancelled) {
          setContextError(caught instanceof Error ? caught.message : 'Unable to gather context')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [idToken, todoistConfigured])

  // Keep the newest turn in view as tokens arrive.
  useEffect(() => {
    const node = transcriptRef.current
    if (node) {
      node.scrollTop = node.scrollHeight
    }
  }, [turns, streaming])

  useEffect(() => () => abortRef.current?.abort(), [])

  function contextBlock(current: AceContext) {
    return `Context for today:\n\n${renderAceContext(current)}`
  }

  async function handleBriefing() {
    if (!config || !context || isBriefing) return

    setIsBriefing(true)
    setBriefingError('')
    setBriefing('')

    try {
      const text = await aceChat({
        config,
        idToken,
        messages: [
          { role: 'system', content: ACE_SYSTEM_PROMPT },
          { role: 'user', content: `${contextBlock(context)}\n\n${MORNING_REPORT_PROMPT}` },
        ],
        onProgress: setBriefing,
      })

      setBriefing(text)
      writeCachedBriefing(text)
    } catch (caught) {
      setBriefingError(caught instanceof Error ? caught.message : 'Ace could not write the briefing')
    } finally {
      setIsBriefing(false)
    }
  }

  async function handleAsk() {
    const question = draft.trim()
    if (!config || !question || isThinking) return

    const turn: ChatTurn = { id: `u-${Date.now()}`, role: 'user', content: question }
    const history = [...turns, turn]

    setTurns(history)
    setDraft('')
    setChatError('')
    setStreaming('')
    setIsThinking(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const messages: AceMessage[] = [
        { role: 'system', content: ACE_SYSTEM_PROMPT },
        ...(context ? [{ role: 'system' as const, content: contextBlock(context) }] : []),
        ...history.map((entry) => ({ role: entry.role, content: entry.content })),
      ]

      const answer = await aceChat({
        config,
        idToken,
        messages,
        signal: controller.signal,
        onProgress: setStreaming,
      })

      setTurns((current) => [...current, { id: `a-${Date.now()}`, role: 'assistant', content: answer }])
    } catch (caught) {
      if (!controller.signal.aborted) {
        setChatError(caught instanceof Error ? caught.message : 'Ace could not answer')
      }
    } finally {
      setStreaming('')
      setIsThinking(false)
      abortRef.current = null
    }
  }

  /** Turn the box's contents into a proposed task, for confirmation. */
  async function handleRemember() {
    const note = draft.trim()
    if (!config || !note || isThinking) return

    setChatError('')
    setReminderNotice('')
    setIsThinking(true)

    try {
      const extracted = await aceJson<ReminderDraft>({
        config,
        idToken,
        format: REMINDER_SCHEMA,
        messages: [
          { role: 'system', content: ACE_SYSTEM_PROMPT },
          { role: 'user', content: reminderExtractionPrompt(note, todayKey()) },
        ],
      })

      if (!extracted.isReminder || !extracted.content.trim()) {
        setChatError('That did not look like something to remember. Try phrasing it as a thing to do.')
        return
      }

      setReminder(extracted)
      setReminderNote(note)
      setDraft('')
    } catch (caught) {
      setChatError(caught instanceof Error ? caught.message : 'Ace could not read that as a reminder')
    } finally {
      setIsThinking(false)
    }
  }

  async function handleSaveReminder() {
    if (!reminder || isSavingReminder) return

    setIsSavingReminder(true)
    setChatError('')

    try {
      await createTask(reminder.content, reminder.dueDate || undefined, reminder.priority)
      setReminderNotice(`Added to Todoist${reminder.dueDate ? ` for ${reminder.dueDate}` : ''}.`)
      setReminder(null)
      setReminderNote('')
    } catch (caught) {
      setChatError(caught instanceof Error ? caught.message : 'Could not create the task')
    } finally {
      setIsSavingReminder(false)
    }
  }

  const unread = context?.mail.filter((message) => message.unread).length ?? 0
  const eventsToday = useMemo(() => {
    if (!context) return 0
    const now = context.now
    return context.events.filter((event) => {
      const date = new Date(event.start)
      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      )
    }).length
  }, [context])

  return (
    <article className="info-card admin-card ace-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        <div className="admin-card-actions">
          {config ? (
            <span className="admin-pill">{config.model}</span>
          ) : (
            <span className="admin-pill">Offline</span>
          )}
        </div>
      </div>

      <div className="ace-panes">
        {/* ── Briefing ─────────────────────────────────────────────────── */}
        <section className="ace-pane" aria-label="Briefing">
          <div className="ace-pane-head">
            <h4>Briefing</h4>
            {config && context ? (
              <button
                type="button"
                className="ace-ghost-btn"
                onClick={handleBriefing}
                disabled={isBriefing}
              >
                {isBriefing ? (
                  <RefreshCw size={13} strokeWidth={1.8} className="ace-spin" aria-hidden="true" />
                ) : (
                  <Sparkles size={13} strokeWidth={1.8} aria-hidden="true" />
                )}
                <span>{isBriefing ? 'Writing…' : briefing ? 'Redo' : 'Good morning'}</span>
              </button>
            ) : null}
          </div>

          {contextError ? <p className="sheets-meta">{contextError}</p> : null}

          {context ? (
            <div className="ace-facts">
              <span className="ace-fact">
                <strong>{context.completedYesterday.length}</strong> done yesterday
              </span>
              <span className={`ace-fact${context.slippedYesterday.length ? ' ace-fact-warn' : ''}`}>
                <strong>{context.slippedYesterday.length}</strong> slipped
              </span>
              <span className="ace-fact">
                <strong>{unread}</strong> unread
              </span>
              <span className="ace-fact">
                <strong>{eventsToday}</strong> today
              </span>
              {context.wellness?.sleep_score ? (
                <span className="ace-fact">
                  sleep <strong>{context.wellness.sleep_score}</strong>
                </span>
              ) : null}
            </div>
          ) : (
            <p className="sheets-meta">Gathering today…</p>
          )}

          {briefingError ? <p className="sheets-meta">{briefingError}</p> : null}

          {briefing ? (
            <AceMarkdown text={briefing} className="ace-briefing-body" />
          ) : !config ? (
            <p className="sheets-meta">
              Set <code>VITE_ACE_BASE_URL</code> to your Ace worker to get a written briefing. The
              counts above work without it.
            </p>
          ) : !isBriefing ? (
            <p className="sheets-meta">
              Press <strong>Good morning</strong> for a read on overnight mail, today&apos;s schedule,
              what slipped, and last night&apos;s recovery.
            </p>
          ) : null}

          {context && context.slippedYesterday.length > 0 ? (
            <div className="ace-slipped">
              <h5>Slipped to today</h5>
              <ul className="recap-list recap-list-slipped">
                {context.slippedYesterday.map((task) => (
                  <li key={task.id}>{task.content}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {context && context.gaps.length > 0 ? (
            <p className="sheets-meta">Not reachable: {context.gaps.join(', ')}.</p>
          ) : null}
        </section>

        {/* ── Chat ─────────────────────────────────────────────────────── */}
        <section className="ace-pane" aria-label="Chat with Ace">
          <div className="ace-pane-head">
            <h4>Ask Ace</h4>
          </div>

          {!config ? (
            <p className="sheets-meta">
              Ace runs on your own machine. Point <code>VITE_ACE_BASE_URL</code> at the worker in
              front of Ollama and set <code>VITE_ACE_MODEL</code> to pick the model.
            </p>
          ) : (
            <>
              <div className="ace-transcript" ref={transcriptRef}>
                {turns.length === 0 && !streaming ? (
                  <p className="sheets-meta">
                    Ask about your mail, your week, or your training. Or dump a thought and press
                    Remember to turn it into a task.
                  </p>
                ) : null}

                {turns.map((turn) =>
                  turn.role === 'assistant' ? (
                    <AceMarkdown key={turn.id} text={turn.content} className="ace-turn ace-turn-assistant" />
                  ) : (
                    <div key={turn.id} className="ace-turn ace-turn-user">
                      {turn.content}
                    </div>
                  ),
                )}

                {streaming ? (
                  <AceMarkdown text={streaming} className="ace-turn ace-turn-assistant" />
                ) : null}

                {isThinking && !streaming ? <p className="sheets-meta">Ace is thinking…</p> : null}
              </div>

              {reminder ? (
                <div className="ace-reminder" role="group" aria-label="Proposed reminder">
                  <div className="ace-reminder-body">
                    <strong>{reminder.content}</strong>
                    {reminder.dueDate ? <span className="ace-reminder-due">{reminder.dueDate}</span> : null}
                    {reminder.priority >= 3 ? <span className="ace-reminder-due">priority {reminder.priority}</span> : null}
                  </div>
                  <div className="ace-reminder-actions">
                    <button type="button" onClick={handleSaveReminder} disabled={isSavingReminder}>
                      <Plus size={13} strokeWidth={1.8} aria-hidden="true" />
                      <span>{isSavingReminder ? 'Adding…' : 'Add to Todoist'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReminder(null)
                        setDraft(reminderNote)
                      }}
                      disabled={isSavingReminder}
                    >
                      <X size={13} strokeWidth={1.8} aria-hidden="true" />
                      <span>Discard</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {reminderNotice ? <p className="sheets-meta">{reminderNotice}</p> : null}
              {chatError ? <p className="sheets-meta">{chatError}</p> : null}

              <form
                className="ace-composer"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleAsk()
                }}
              >
                <label className="sr-only" htmlFor="ace-input">
                  Message Ace
                </label>
                <textarea
                  id="ace-input"
                  value={draft}
                  rows={2}
                  placeholder="Ask a question, or dump a thought…"
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter sends; Shift+Enter is a newline.
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void handleAsk()
                    }
                  }}
                />
                <div className="ace-composer-actions">
                  <button
                    type="button"
                    className="ace-ghost-btn"
                    onClick={handleRemember}
                    disabled={!draft.trim() || isThinking || !todoistConfigured}
                    title={
                      todoistConfigured
                        ? 'Turn this into a Todoist task'
                        : 'Set VITE_TODOIST_API_TOKEN to create reminders'
                    }
                  >
                    <Plus size={13} strokeWidth={1.8} aria-hidden="true" />
                    <span>Remember</span>
                  </button>
                  <button type="submit" className="ace-send-btn" disabled={!draft.trim() || isThinking}>
                    <Send size={14} strokeWidth={1.8} aria-hidden="true" />
                    <span>Ask</span>
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </article>
  )
}
