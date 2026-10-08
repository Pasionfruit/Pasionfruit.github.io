import { useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { AceChat } from './AceChat'
import { NEWS_SUMMARY_EVENT, type NewsSummaryRequest } from './newsSummary'

/**
 * Ace as a floating button in the bottom-right corner of every admin page.
 *
 * The chat mounts on first open, not on page load — gathering context reads
 * mail, calendar, Todoist, Garmin and the journal, which is too much to do on
 * every visit just in case. Once mounted it stays mounted (hidden when closed),
 * so the conversation survives closing the panel and changing dashboards.
 */
export function AceLauncher({ idToken, todoistConfigured }: { idToken: string; todoistConfigured: boolean }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [newsRequest, setNewsRequest] = useState<NewsSummaryRequest | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    function onNewsSummary(event: Event) {
      setNewsRequest((event as CustomEvent<NewsSummaryRequest>).detail)
      setMounted(true)
      setOpen(true)
    }
    window.addEventListener(NEWS_SUMMARY_EVENT, onNewsSummary)
    return () => window.removeEventListener(NEWS_SUMMARY_EVENT, onNewsSummary)
  }, [])

  function openPanel() {
    setMounted(true)
    setOpen(true)
  }

  function closePanel() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className={`ace-launcher${open ? ' is-open' : ''}`}>
      {mounted ? (
        <section
          id="ace-panel"
          className="ace-panel"
          role="dialog"
          aria-labelledby="ace-panel-title"
          hidden={!open}
        >
          <AceChat idToken={idToken} todoistConfigured={todoistConfigured} open={open} onClose={closePanel} newsRequest={newsRequest} />
        </section>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        className="ace-fab"
        aria-expanded={open}
        aria-controls={mounted ? 'ace-panel' : undefined}
        aria-label={open ? 'Close Ace' : 'Open Ace'}
        title={open ? 'Close Ace' : 'Ask Ace'}
        onClick={() => (open ? closePanel() : openPanel())}
      >
        {open ? (
          <X size={22} strokeWidth={1.9} aria-hidden="true" />
        ) : (
          <Sparkles size={22} strokeWidth={1.9} aria-hidden="true" />
        )}
      </button>
    </div>
  )
}
