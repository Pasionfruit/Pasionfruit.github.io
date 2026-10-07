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

export function AceMarkdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={className}>
      {text.split('\n').map((line, index) => {
        const trimmed = line.trim()
        if (!trimmed) return null

        // The prompt forbids # headings, but a small model uses them anyway
        // often enough that printing the hashes would look broken.
        const hashHeading = /^#{1,6}\s+(.*)$/.exec(trimmed)
        if (hashHeading) {
          return (
            <p key={index} className="ace-md-heading">
              <span className="ace-md-label">{hashHeading[1].replace(/\*\*/g, '')}</span>
            </p>
          )
        }

        /*
         * A line opening with a bold run is a section heading, and the rest of
         * that line is its body — which must not inherit the heading's weight,
         * or every briefing section reads as a title with nothing under it.
         */
        const heading = /^\*\*(.+?)\*\*\s*(.*)$/.exec(trimmed)
        if (heading) {
          const body = heading[2].replace(/^[\s:—–-]+/, '')
          // A real space, not a CSS one: pseudo-element content is not copied
          // to the clipboard, so "**Meeting** — Call" used to paste as "MeetingCall".
          return (
            <p key={index} className="ace-md-heading">
              <span className="ace-md-label">{heading[1]}</span>
              {body ? (
                <>
                  {' '}
                  <span className="ace-md-rest">{inlineBold(body, `b${index}`)}</span>
                </>
              ) : null}
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
