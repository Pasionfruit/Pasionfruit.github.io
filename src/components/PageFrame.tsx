import type { CSSProperties, ReactNode } from 'react'
import { Link } from 'react-router-dom'

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="social-icon">
      <path
        d="M7.2 9.2V20H3.7V9.2h3.5Zm.3-3.4a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20.5 13.8V20H17v-5.7c0-1.4-.5-2.3-1.8-2.3-1 0-1.6.7-1.8 1.3-.1.3-.1.7-.1 1V20H9.8s0-9.3 0-10.3h3.5V11c.5-.8 1.4-1.9 3.3-1.9 2.4 0 3.9 1.6 3.9 4.7Z"
        fill="currentColor"
      />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="social-icon">
      <path
        d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.9.6-3.5-1.2-3.5-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.6 1.1 1.6 1.1.9 1.6 2.3 1.1 2.9.9.1-.6.4-1.1.7-1.3-2.3-.3-4.8-1.2-4.8-5.3 0-1.2.4-2.1 1.1-2.8-.1-.3-.5-1.4.1-2.9 0 0 .9-.3 3 .9a10.2 10.2 0 0 1 5.4 0c2.1-1.2 3-.9 3-.9.6 1.5.2 2.6.1 2.9.7.7 1.1 1.6 1.1 2.8 0 4.1-2.5 5-4.8 5.3.4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"
        fill="currentColor"
      />
    </svg>
  )
}

function StravaIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="social-icon">
      <path d="M14.1 4 8.2 15.4h3.5l2.4-4.6 2.4 4.6H20L14.1 4Z" fill="currentColor" />
      <path d="M10.8 16.8 8.3 21h3l1-2 1 2h3l-2.5-4.2h-2.3Z" fill="currentColor" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="social-icon">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="3.9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
    </svg>
  )
}

function SpotifyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="social-icon">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7.4 10.3c3.1-1 6.4-.8 9.2.7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
      <path d="M8.1 13c2.4-.7 4.9-.5 7 .6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.45" />
      <path d="M8.9 15.4c1.8-.5 3.6-.4 5.1.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.3" />
    </svg>
  )
}

function normalizeHandle(value: string) {
  return value.replace(/^@/, '').trim()
}

function linkedInProfile(value: string) {
  return value.startsWith('http')
    ? value
    : `https://www.linkedin.com/in/${normalizeHandle(value)}/`
}

function githubProfile(value: string) {
  return value.startsWith('http')
    ? value
    : `https://github.com/${normalizeHandle(value)}`
}

function stravaProfile(value: string) {
  if (value.startsWith('http')) {
    return value
  }

  const normalized = normalizeHandle(value)
  return /^\d+$/.test(normalized)
    ? `https://www.strava.com/athletes/${normalized}`
    : `https://www.strava.com/${normalized}`
}

function instagramProfile(value: string) {
  return value.startsWith('http')
    ? value
    : `https://www.instagram.com/${normalizeHandle(value)}/`
}

function spotifyProfile(value: string) {
  return value.startsWith('http')
    ? value
    : `https://open.spotify.com/user/${normalizeHandle(value)}`
}

function linkedInLabel(value: string) {
  if (!value.startsWith('http')) {
    return normalizeHandle(value)
  }

  const match = value.match(/linkedin\.com\/in\/([^/?#]+)/i)
  return match?.[1] ?? value
}

function githubLabel(value: string) {
  if (!value.startsWith('http')) {
    return normalizeHandle(value)
  }

  const match = value.match(/github\.com\/([^/?#]+)/i)
  return match?.[1] ?? value
}

function stravaLabel(value: string) {
  if (!value.startsWith('http')) {
    return normalizeHandle(value)
  }

  const match = value.match(/strava\.com\/(?:athletes\/)?([^/?#]+)/i)
  const handle = match?.[1]

  if (handle === '116157184') {
    return 'PainTracker'
  }

  return handle ?? value
}

function instagramLabel(value: string) {
  if (!value.startsWith('http')) {
    return normalizeHandle(value)
  }

  const match = value.match(/instagram\.com\/([^/?#]+)/i)
  return match?.[1] ?? value
}

function spotifyLabel(value: string) {
  if (!value.startsWith('http')) {
    return normalizeHandle(value)
  }

  const match = value.match(/open\.spotify\.com\/(?:user|artist)\/([^/?#]+)/i)
  const handle = match?.[1]

  if (handle === 'de0y0osvptr9ac25r3pxaq9j0') {
    return 'Mr.Pasionfruit'
  }

  return handle ?? value
}

export function SummaryText({ summary }: { summary: string }) {
  const lines = summary
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return (
    <div className="page-summary page-summary-block">
      {lines.map((line) => {
        const cleanedLine = line.replace(/^[-•]\s*/, '')
        const lower = cleanedLine.toLowerCase()

        if (lower.startsWith('linkedin:')) {
          const rawValue = cleanedLine.slice(cleanedLine.indexOf(':') + 1).trim()
          const href = linkedInProfile(rawValue)
          const label = linkedInLabel(rawValue)
          return (
            <a
              key={line}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="social-link"
            >
              <LinkedInIcon />
              <span>{label}</span>
            </a>
          )
        }

        if (lower.startsWith('github:')) {
          const rawValue = cleanedLine.slice(cleanedLine.indexOf(':') + 1).trim()
          const href = githubProfile(rawValue)
          const label = githubLabel(rawValue)
          return (
            <a
              key={line}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="social-link"
            >
              <GitHubIcon />
              <span>{label}</span>
            </a>
          )
        }

        if (lower.startsWith('strava:')) {
          const rawValue = cleanedLine.slice(cleanedLine.indexOf(':') + 1).trim()
          const href = stravaProfile(rawValue)
          const label = stravaLabel(rawValue)
          return (
            <a
              key={line}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="social-link"
            >
              <StravaIcon />
              <span>{label}</span>
            </a>
          )
        }

        if (lower.startsWith('instagram:') || lower.startsWith('ig:')) {
          const rawValue = cleanedLine.slice(cleanedLine.indexOf(':') + 1).trim()
          const href = instagramProfile(rawValue)
          const label = instagramLabel(rawValue)
          return (
            <a
              key={line}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="social-link"
            >
              <InstagramIcon />
              <span>{label}</span>
            </a>
          )
        }

        if (lower.startsWith('spotify:')) {
          const rawValue = cleanedLine.slice(cleanedLine.indexOf(':') + 1).trim()
          const href = spotifyProfile(rawValue)
          const label = spotifyLabel(rawValue)
          return (
            <a
              key={line}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="social-link"
            >
              <SpotifyIcon />
              <span>{label}</span>
            </a>
          )
        }

        return (
          <span key={line} className="summary-line">
            {cleanedLine}
          </span>
        )
      })}
    </div>
  )
}

export function PageFrame({
  eyebrow,
  title,
  summary,
  accent,
  backLink,
  backLabel,
  note,
  downloadPdfHref,
  downloadWordHref,
  gridClassName,
  children,
}: {
  eyebrow: string
  title: string
  summary: string
  accent: string
  backLink: string
  backLabel: string
  note: string
  downloadPdfHref?: string
  downloadWordHref?: string
  gridClassName?: string
  children: ReactNode
}) {
  return (
    <div className="page-frame" style={{ '--page-accent': accent } as CSSProperties}>
      <section className="page-hero">
        <div className="page-hero-header">
          <Link to={backLink} className="back-link" aria-label={backLabel} title={backLabel}>
            <span aria-hidden="true">&lt;</span>
          </Link>

          <div className="page-title-block">
            <p className="eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
          </div>
        </div>
        <SummaryText summary={summary} />
        <div className="page-note-row">
          <p className="page-note">{note}</p>
          {downloadPdfHref || downloadWordHref ? (
            <div className="download-actions" aria-label="Download files">
              {downloadPdfHref ? (
                <a href={downloadPdfHref} className="download-link" download>
                  Download PDF
                </a>
              ) : null}
              {downloadWordHref ? (
                <a href={downloadWordHref} className="download-link" download>
                  Download Word
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className={`page-grid${gridClassName ? ` ${gridClassName}` : ''}`}>{children}</section>
    </div>
  )
}
