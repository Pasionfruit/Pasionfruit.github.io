import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Mic, MicOff, Send, Sparkles, Plus, RefreshCw, X } from 'lucide-react'
import {
  aceChat,
  aceJson,
  aceTts,
  getAceConfig,
  type AceMessage,
} from './ace/client'
import { buildAceContext, renderAceContext, type AceContext } from './ace/context'
import {
  ACE_SYSTEM_PROMPT,
  COMPLETION_SCHEMA,
  MORNING_REPORT_PROMPT,
  REMINDER_SCHEMA,
  completionExtractionPrompt,
  reminderExtractionPrompt,
  type CompletionDraft,
  type ReminderDraft,
} from './ace/prompts'
import { closeTask, createTask } from '../data/todoist/repositories'
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

        const numbered = /^(\d+)[.)]\s+(.*)$/.exec(trimmed)
        if (numbered) {
          return (
            <p key={index} className="ace-md-item ace-md-item-numbered">
              <span className="ace-md-num">{numbered[1]}.</span>
              <span>{inlineBold(numbered[2], `n${index}`)}</span>
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

  const [completion, setCompletion] = useState<{ id: string; content: string } | null>(null)
  const [isClosingTask, setIsClosingTask] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)

  /* ── Voice mode: press the mic, speak, hear the reply, speak again. ── */
  const [voiceState, setVoiceState] = useState<'off' | 'listening' | 'speaking'>('off')
  const voiceOnRef = useRef(false)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)

  const speechSupported = useMemo(() => {
    if (typeof window === 'undefined') return false
    const w = window as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }
    return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition) && 'speechSynthesis' in window
  }, [])

  /*
   * Voice quality: the default system voice is the robotic one. Prefer the
   * "natural" neural voices Edge ships, then Google's, then any English voice.
   * getVoices() is empty until the browser fires voiceschanged, so keep a ref.
   */
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])

  function pickVoice(): SpeechSynthesisVoice | null {
    const english = voicesRef.current.filter((voice) => voice.lang.toLowerCase().startsWith('en'))
    return (
      english.find((voice) => /natural/i.test(voice.name) && /en-US/i.test(voice.lang)) ??
      english.find((voice) => /natural/i.test(voice.name)) ??
      english.find((voice) => /Google US English/i.test(voice.name)) ??
      english.find((voice) => /Google/i.test(voice.name)) ??
      english[0] ??
      null
    )
  }

  /*
   * Rocky's signature: he speaks in musical chords. A short bell-like arpeggio
   * marks the start and end of Ace's speech — synthesized here, so it works
   * offline and costs nothing.
   */
  const audioCtxRef = useRef<AudioContext | null>(null)

  function playChord(frequencies: number[], duration = 0.55) {
    try {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
      const Ctx = w.AudioContext ?? w.webkitAudioContext
      if (!Ctx) return
      const ctx = audioCtxRef.current ?? new Ctx()
      audioCtxRef.current = ctx
      void ctx.resume()

      const now = ctx.currentTime
      frequencies.forEach((frequency, index) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = frequency
        const start = now + index * 0.08
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.1, start + 0.05)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + duration + 0.05)
      })
    } catch {
      // A blocked or missing AudioContext should never break speech itself.
    }
  }

  /** Bright rising chord: Ace is about to speak. */
  const CHORD_SPEAK = [659.25, 783.99, 987.77] // E5 · G5 · B5
  /** Soft settling chord: your turn. */
  const CHORD_DONE = [523.25, 659.25, 783.99] // C5 · E5 · G5

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

  useEffect(
    () => () => {
      abortRef.current?.abort()
      voiceOnRef.current = false
      recognitionRef.current?.stop()
      audioRef.current?.pause()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    },
    [],
  )

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

  /** Every open task Ace can be told about, deduplicated. */
  function openTasks() {
    if (!context) return []
    const seen = new Set<string>()
    return [...context.tasksToday, ...context.tasksOverdue, ...context.slippedYesterday].filter(
      (task) => !seen.has(task.id) && Boolean(seen.add(task.id)),
    )
  }

  async function handleConfirmComplete() {
    if (!completion || isClosingTask) return
    setIsClosingTask(true)
    setChatError('')

    try {
      await closeTask(completion.id)
      setTurns((current) => [
        ...current,
        { id: `a-${Date.now()}`, role: 'assistant', content: `Done — checked off **${completion.content}**.` },
      ])
      // Keep the local context honest so the same task cannot be matched twice.
      setContext((current) =>
        current
          ? {
              ...current,
              tasksToday: current.tasksToday.filter((task) => task.id !== completion.id),
              tasksOverdue: current.tasksOverdue.filter((task) => task.id !== completion.id),
              slippedYesterday: current.slippedYesterday.filter((task) => task.id !== completion.id),
            }
          : current,
      )
      if (voiceOnRef.current) void speakReply(`Checked off ${completion.content}.`)
      setCompletion(null)
    } catch (caught) {
      setChatError(caught instanceof Error ? caught.message : 'Could not close the task')
    } finally {
      setIsClosingTask(false)
    }
  }

  /** Markdown reads badly aloud; strip it before it reaches the voice. */
  function speechText(markdown: string) {
    return markdown
      .replace(/\*\*/g, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/`+/g, '')
      .trim()
  }

  const audioRef = useRef<HTMLAudioElement | null>(null)

  function stopSpeaking() {
    audioRef.current?.pause()
    audioRef.current = null
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  /** Browser TTS — the fallback when the local Kokoro voice is unreachable. */
  function fallbackSpeak(text: string) {
    if (!('speechSynthesis' in window)) return

    const utterance = new SpeechSynthesisUtterance(text)
    const voice = pickVoice()
    if (voice) utterance.voice = voice
    utterance.pitch = 0.92
    utterance.rate = 1.02
    utterance.onend = () => {
      playChord(CHORD_DONE, 0.45)
      if (voiceOnRef.current) startListening()
    }
    // Let the chord ring for a beat before the words begin.
    window.setTimeout(() => window.speechSynthesis.speak(utterance), 380)
  }

  /**
   * Speak with the Kokoro model running next to Ollama (human-like), falling
   * back to the browser's synthesis when the host or tunnel is down.
   */
  async function speakReply(markdown: string) {
    const text = speechText(markdown)
    if (!text) return

    stopSpeaking()
    playChord(CHORD_SPEAK)
    setVoiceState('speaking')

    try {
      if (!config) throw new Error('not configured')
      const blob = await aceTts({ config, idToken, text })
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        URL.revokeObjectURL(url)
        if (audioRef.current === audio) audioRef.current = null
        playChord(CHORD_DONE, 0.45)
        if (voiceOnRef.current) startListening()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        fallbackSpeak(text)
      }
      await audio.play()
    } catch {
      fallbackSpeak(text)
    }
  }

  function startListening() {
    type RecognitionLike = {
      lang: string
      interimResults: boolean
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
      onerror: ((event: { error?: string }) => void) | null
      onend: (() => void) | null
      start: () => void
      stop: () => void
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => RecognitionLike
      webkitSpeechRecognition?: new () => RecognitionLike
    }
    const Recognition = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Recognition || !voiceOnRef.current) return

    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.interimResults = true

    let finalText = ''
    recognition.onresult = (event) => {
      const spoken = Array.from({ length: event.results.length }, (_, i) => event.results[i][0].transcript)
        .join(' ')
        .trim()
      setDraft(spoken)
      if (event.results[event.results.length - 1].isFinal) {
        finalText = spoken
      }
    }
    recognition.onerror = (event) => {
      // Silence and manual stops are routine; anything else ends voice mode.
      if (event.error && event.error !== 'no-speech' && event.error !== 'aborted') {
        voiceOnRef.current = false
        setVoiceState('off')
        setChatError(`Voice input failed (${event.error}).`)
      }
    }
    recognition.onend = () => {
      recognitionRef.current = null
      if (!voiceOnRef.current) return
      if (finalText) {
        setDraft('')
        void handleAsk(finalText)
      } else {
        // Silence timeout — keep the mic open while voice mode is on.
        startListening()
      }
    }

    recognitionRef.current = recognition
    setVoiceState('listening')
    recognition.start()
  }

  function toggleVoice() {
    if (voiceOnRef.current) {
      voiceOnRef.current = false
      setVoiceState('off')
      recognitionRef.current?.stop()
      stopSpeaking()
    } else {
      voiceOnRef.current = true
      setChatError('')
      playChord(CHORD_DONE, 0.4)
      startListening()
    }
  }

  async function handleAsk(spoken?: string) {
    const question = (spoken ?? draft).trim()
    if (!config || !question || isThinking) return

    // A pending "mark complete?" chip can be answered by voice or text.
    if (completion) {
      if (/^(yes|yeah|yep|sure|do it|confirm|check it|mark it)\b/i.test(question)) {
        setDraft('')
        void handleConfirmComplete()
        return
      }
      if (/^(no|nope|cancel|leave it|not that)\b/i.test(question)) {
        setCompletion(null)
        setDraft('')
        if (voiceOnRef.current) startListening()
        return
      }
    }

    const turn: ChatTurn = { id: `u-${Date.now()}`, role: 'user', content: question }
    const history = [...turns, turn]

    setTurns(history)
    setDraft('')
    setChatError('')
    setStreaming('')
    setIsThinking(true)

    // "I did X" → offer to check off the matching task instead of chatting.
    if (todoistConfigured && /\b(did|done|finished|finish|complete|completed|closed|checked)\b/i.test(question)) {
      const open = openTasks()
      if (open.length > 0) {
        try {
          const extracted = await aceJson<CompletionDraft>({
            config,
            idToken,
            format: COMPLETION_SCHEMA,
            messages: [
              { role: 'system', content: ACE_SYSTEM_PROMPT },
              {
                role: 'user',
                content: completionExtractionPrompt(
                  question,
                  open.map((task) => ({ id: task.id, content: task.content })),
                ),
              },
            ],
          })
          const match = extracted.isCompletion ? open.find((task) => task.id === extracted.taskId) : undefined
          if (match) {
            setCompletion({ id: match.id, content: match.content })
            setIsThinking(false)
            if (voiceOnRef.current) void speakReply(`Should I check off ${match.content}?`)
            return
          }
        } catch {
          // Extraction is best-effort; fall through to a normal chat turn.
        }
      }
    }

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

      if (voiceOnRef.current) {
        void speakReply(answer)
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        setChatError(caught instanceof Error ? caught.message : 'Ace could not answer')
        // Keep the conversation open: a failed turn should not strand the mic.
        if (voiceOnRef.current) startListening()
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

                {isThinking && !streaming ? (
                  <div className="ace-typing" role="status" aria-label="Ace is thinking">
                    <span />
                    <span />
                    <span />
                  </div>
                ) : null}
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

              {completion ? (
                <div className="ace-reminder" role="group" aria-label="Task to complete">
                  <div className="ace-reminder-body">
                    <strong>{completion.content}</strong>
                    <span className="ace-reminder-due">mark complete?</span>
                  </div>
                  <div className="ace-reminder-actions">
                    <button type="button" onClick={() => void handleConfirmComplete()} disabled={isClosingTask}>
                      <Check size={13} strokeWidth={1.8} aria-hidden="true" />
                      <span>{isClosingTask ? 'Closing…' : 'Complete'}</span>
                    </button>
                    <button type="button" onClick={() => setCompletion(null)} disabled={isClosingTask}>
                      <X size={13} strokeWidth={1.8} aria-hidden="true" />
                      <span>Not this</span>
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
                  {speechSupported ? (
                    <button
                      type="button"
                      className={`ace-ghost-btn ace-voice-btn${voiceState !== 'off' ? ' active' : ''}`}
                      onClick={toggleVoice}
                      title={voiceState === 'off' ? 'Talk to Ace' : 'End the voice conversation'}
                    >
                      {voiceState === 'off' ? (
                        <Mic size={13} strokeWidth={1.8} aria-hidden="true" />
                      ) : (
                        <MicOff size={13} strokeWidth={1.8} aria-hidden="true" />
                      )}
                      <span>
                        {voiceState === 'listening' ? 'Listening…' : voiceState === 'speaking' ? 'Speaking…' : 'Voice'}
                      </span>
                    </button>
                  ) : null}
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
