import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google'
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import './App.css'
import {
  actuaryExamEntries,
  detailPages,
  educationEntries,
  milestoneEntries,
  navSections,
  professionalExperienceEntries,
  sectionPages,
  type ActuaryExamEntry,
  type EducationEntry,
  type MilestoneEntry,
  type ProfessionalExperienceEntry,
  type SectionId,
} from './siteContent'
import {
  getBucketList,
  getCountries,
  getPolls,
  setBucketCompleted,
  setCountryVisited,
  votePoll,
} from './data/sheets/repositories'
import type {
  BucketListRecord,
  CountryRecord,
  PollRecord,
} from './data/sheets/types'

type ThemeMode = 'light' | 'dark'
type UserProfile = 'guest' | 'admin'

const googleClientConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim())

function getInitialProfile(): UserProfile {
  if (typeof window === 'undefined') {
    return 'guest'
  }

  const storedProfile = window.localStorage.getItem('demo-profile')
  return storedProfile === 'admin' ? 'admin' : 'guest'
}

function getInitialGoogleToken() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem('google-id-token') ?? ''
}

function getActiveSectionId(pathname: string): SectionId | undefined {
  return navSections.find(
    (section) => pathname === section.path || pathname.startsWith(`${section.path}/`),
  )?.id
}

function App() {
  const [profile, setProfile] = useState<UserProfile>(() => getInitialProfile())
  const [googleIdToken, setGoogleIdToken] = useState(() => getInitialGoogleToken())

  useEffect(() => {
    window.localStorage.setItem('demo-profile', profile)
  }, [profile])

  useEffect(() => {
    if (!googleIdToken) {
      window.localStorage.removeItem('google-id-token')
      return
    }

    window.localStorage.setItem('google-id-token', googleIdToken)
  }, [googleIdToken])

  return (
    <Routes>
      <Route element={<SiteLayout profile={profile} />}>
        <Route index element={<HomePage />} />
        <Route
          path="login"
          element={(
            <LoginPage
              profile={profile}
              onSwitchProfile={setProfile}
              googleIdToken={googleIdToken}
              onGoogleTokenChange={setGoogleIdToken}
            />
          )}
        />
        <Route
          path="mrpasionfruit"
          element={<SectionPage sectionId="mrpasionfruit" profile={profile} googleIdToken={googleIdToken} />}
        />
        <Route path="mrpasionfruit/oreo-gang" element={<DetailPage path="/mrpasionfruit/oreo-gang" />} />
        <Route path="mrpasionfruit/interests" element={<DetailPage path="/mrpasionfruit/interests" />} />
        <Route
          path="training"
          element={<SectionPage sectionId="training" profile={profile} googleIdToken={googleIdToken} />}
        />
        <Route path="training/records" element={<DetailPage path="/training/records" />} />
        <Route path="training/data" element={<DetailPage path="/training/data" />} />
        <Route path="training/learn" element={<DetailPage path="/training/learn" />} />
        <Route
          path="experiences"
          element={<SectionPage sectionId="experiences" profile={profile} googleIdToken={googleIdToken} />}
        />
        <Route path="experiences/studying" element={<DetailPage path="/experiences/studying" />} />
        <Route path="experience/studying" element={<Navigate replace to="/experiences/studying" />} />
        <Route
          path="cooking"
          element={<SectionPage sectionId="cooking" profile={profile} googleIdToken={googleIdToken} />}
        />
        <Route path="cooking/recipes" element={<DetailPage path="/cooking/recipes" />} />
        <Route path="cooking/plan" element={<DetailPage path="/cooking/plan" />} />
        <Route path="cooking/learn" element={<DetailPage path="/cooking/learn" />} />
        <Route path="cooking/deals" element={<DetailPage path="/cooking/deals" />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
  )
}

function SiteLayout({ profile }: { profile: UserProfile }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme())
  const location = useLocation()
  const activeSectionId = getActiveSectionId(location.pathname)
  const [expandedSectionIds, setExpandedSectionIds] = useState<SectionId[]>(() =>
    activeSectionId ? [activeSectionId] : [],
  )

  useEffect(() => {
    setMenuOpen(false)

    if (activeSectionId) {
      setExpandedSectionIds((previous) =>
        previous.includes(activeSectionId) ? previous : [...previous, activeSectionId],
      )
    }
  }, [location.pathname])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    window.localStorage.setItem('theme-mode', theme)
  }, [theme])

  function toggleSection(sectionId: SectionId) {
    setExpandedSectionIds((previous) =>
      previous.includes(sectionId)
        ? previous.filter((id) => id !== sectionId)
        : [...previous, sectionId],
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Go to home page">
          <span className="brand-mark">PF</span>
          <span className="brand-copy">
            <strong>Pasionfruit</strong>
            <small>Enjoying life</small>
          </span>
        </Link>

        <div className="topbar-actions">
          <span className="profile-pill" aria-label="Current profile">
            {profile.toUpperCase()}
          </span>
          <button
            type="button"
            className="theme-toggle"
            aria-label={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'}
            aria-pressed={theme === 'dark'}
            title={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'}
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
          >
            <SunIcon active={theme === 'light'} />
            <MoonIcon active={theme === 'dark'} />
          </button>
          <NavLink to="/login" className="login-link">
            Login
          </NavLink>
          <button
            type="button"
            className="menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="site-menu"
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
            <span className="sr-only">Toggle navigation</span>
          </button>
        </div>
      </header>

      <div className={`menu-backdrop ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />

      <aside id="site-menu" className={`menu-panel ${menuOpen ? 'open' : ''}`}>
        <div className="menu-panel-header">
          <p>Browse pages</p>
          <button type="button" className="menu-close" onClick={() => setMenuOpen(false)}>
            Close
          </button>
        </div>

        <nav className="menu-root" aria-label="Primary">
          {navSections.map((section) => {
            const isExpanded = expandedSectionIds.includes(section.id)

            return (
              <div key={section.id} className="menu-section-card">
                <div className="menu-section-row">
                  <button
                    type="button"
                    className="menu-expander"
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${section.title}`}
                    aria-expanded={isExpanded}
                    onClick={() => toggleSection(section.id)}
                  >
                    {isExpanded ? '▾' : '▸'}
                  </button>

                  <NavLink
                    to={section.path}
                    className={({ isActive }) =>
                      `menu-main-link ${isActive ? 'active' : ''}`
                    }
                  >
                    {section.title}
                  </NavLink>
                </div>

                <p className="menu-section-summary">{section.summary}</p>

                {isExpanded ? (
                  <div className="menu-children">
                    {section.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) =>
                          `menu-child-link ${isActive ? 'active' : ''}`
                        }
                      >
                        <span>{child.label}</span>
                        <small>{child.summary}</small>
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>
      </aside>

      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  )
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const storedTheme = window.localStorage.getItem('theme-mode')
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function SunIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`theme-icon ${active ? 'active' : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23L5.46 5.46"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function MoonIcon({ active }: { active: boolean }) {
  return (
    <svg
      className={`theme-icon ${active ? 'active' : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M15.53 3.73a8.9 8.9 0 1 0 4.74 15.82A9.6 9.6 0 0 1 15.53 3.73Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

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

function SummaryText({ summary }: { summary: string }) {
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

function HomePage() {
  return (
    <div className="page home-page">
      <section id="sections" className="section-block">
        <div className="section-grid">
          {navSections.map((section) => (
            <article
              key={section.id}
              className="section-tile"
              style={{ '--tile-accent': section.accent } as CSSProperties}
            >
              <p>{section.title}</p>
              <h3>{section.summary}</h3>
              <div className="tile-links">
                <Link to={section.path}>Open</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function SectionPage({
  sectionId,
  profile,
  googleIdToken,
}: {
  sectionId: SectionId
  profile: UserProfile
  googleIdToken: string
}) {
  const section = sectionPages[sectionId]
  const navSection = navSections.find((item) => item.id === sectionId)
  const experienceDownloads =
    sectionId === 'experiences'
      ? {
          pdfHref: '/files/abe-pasion-resume.pdf',
          wordHref: '/files/abe-pasion-resume.docx',
        }
      : undefined

  return (
    <PageFrame
      eyebrow={section.eyebrow}
      title={section.title}
      summary={section.summary}
      accent={section.accent}
      backLink="/"
      backLabel="Back home"
      note={section.callout}
      downloadPdfHref={experienceDownloads?.pdfHref}
      downloadWordHref={experienceDownloads?.wordHref}
    >
      {section.cards.map((card) => {
        if (sectionId === 'mrpasionfruit' && card.title === 'Personal interests/questions') {
          return (
            <PollCard
              key={card.title}
              title={card.title}
              fallbackBody={card.body}
              canWrite={profile === 'admin'}
              idToken={googleIdToken}
            />
          )
        }

        if (sectionId === 'mrpasionfruit' && card.title === 'Bucket List') {
          return (
            <BucketListCard
              key={card.title}
              title={card.title}
              fallbackBody={card.body}
              canWrite={profile === 'admin'}
              idToken={googleIdToken}
            />
          )
        }

        if (sectionId === 'mrpasionfruit' && card.title === 'Places visited') {
          return (
            <CountriesCard
              key={card.title}
              title={card.title}
              fallbackBody={card.body}
              canWrite={profile === 'admin'}
              idToken={googleIdToken}
            />
          )
        }

        if (sectionId === 'training' && card.title === 'Next Event Countdown') {
          return <NextEventCountdownCard key={card.title} title={card.title} canEdit={profile === 'admin'} />
        }

        if (sectionId === 'experiences' && card.title === 'Actuary Exams') {
          return <ActuaryExamsCard key={card.title} title={card.title} />
        }

        if (sectionId === 'experiences' && card.title === 'Education') {
          return <EducationCard key={card.title} title={card.title} />
        }

        if (sectionId === 'experiences' && card.title === 'Professional Experience') {
          return <ProfessionalExperienceCard key={card.title} title={card.title} />
        }

        if (sectionId === 'experiences' && card.title === 'Technical Skills') {
          return <TechnicalSkillsCard key={card.title} title={card.title} body={card.body} />
        }

        return (
          <article key={card.title} className="info-card section-page-card">
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        )
      })}

      {navSection?.children.map((child) => (
        <Link key={child.path} to={child.path} className="info-card section-child-card">
          <p className="section-child-label">Open page</p>
          <h3>{child.label}</h3>
          <p>{child.summary}</p>
        </Link>
      ))}
    </PageFrame>
  )
}

function TechnicalSkillsCard({ title, body }: { title: string; body: string }) {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return (
    <article className="info-card section-page-card technical-skills-card">
      <h3>{title}</h3>
      <ul className="technical-skills-list">
        {lines.map((line) => {
          const cleanedLine = line.replace(/^•\s*/, '')
          const isDetail = cleanedLine.startsWith('-')

          return (
            <li key={line} className={isDetail ? 'technical-skill-detail' : 'technical-skill-heading'}>
              {isDetail ? cleanedLine.replace(/^-\s*/, '') : cleanedLine}
            </li>
          )
        })}
      </ul>
    </article>
  )
}

function parseBucketFallback(body: string): BucketListRecord[] {
  return body
    .split('\n')
    .map((line) => line.replace(/^\s*[•-]\s*/, '').trim())
    .filter((line) => line.length > 0)
    .map((item, index) => ({
      bucket_id: `fallback-bucket-${index}`,
      item,
      completed: false,
    }))
}

function PollCard({
  title,
  fallbackBody,
  canWrite,
  idToken,
}: {
  title: string
  fallbackBody: string
  canWrite: boolean
  idToken: string
}) {
  const [rows, setRows] = useState<PollRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')

  async function loadPolls() {
    try {
      const data = await getPolls()
      setRows(data)
    } catch {
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadPolls()
  }, [])

  async function handleVote(selectedOption: 'A' | 'B') {
    if (!idToken || !activePoll || isWriting) {
      return
    }

    const previousRows = rows
    setIsWriting(true)
    setWriteError('')
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.poll_id !== activePoll.poll_id) {
          return row
        }

        const optionAVotes = row.option_a_votes ?? 0
        const optionBVotes = row.option_b_votes ?? 0
        const nextOptionAVotes = selectedOption === 'A' ? optionAVotes + 1 : optionAVotes
        const nextOptionBVotes = selectedOption === 'B' ? optionBVotes + 1 : optionBVotes

        return {
          ...row,
          option_a_votes: nextOptionAVotes,
          option_b_votes: nextOptionBVotes,
          total_votes: (row.total_votes ?? 0) + 1,
          winning_option:
            nextOptionAVotes === nextOptionBVotes
              ? 'tie'
              : nextOptionAVotes > nextOptionBVotes
                ? 'A'
                : 'B',
        }
      }),
    )

    try {
      await votePoll(idToken, activePoll.poll_id, selectedOption)
      void loadPolls()
    } catch (error) {
      setRows(previousRows)
      setWriteError(error instanceof Error ? error.message : 'Unable to submit vote')
    } finally {
      setIsWriting(false)
    }
  }

  const activePoll = [...rows].sort((a, b) => {
    const aTime = a.created_date ? new Date(a.created_date).getTime() : 0
    const bTime = b.created_date ? new Date(b.created_date).getTime() : 0
    return bTime - aTime
  })[0]

  return (
    <article className="info-card section-page-card sheets-card">
      <h3>{title}</h3>
      {isLoading ? <p className="sheets-meta">Loading poll...</p> : null}

      {activePoll ? (
        <>
          <p className="sheets-question">{activePoll.question}</p>
          <ul className="sheets-list">
            <li className="sheets-item">A: {activePoll.option_a} ({activePoll.option_a_votes ?? 0})</li>
            <li className="sheets-item">B: {activePoll.option_b} ({activePoll.option_b_votes ?? 0})</li>
          </ul>
          {canWrite ? (
            idToken ? (
              <div className="sheets-actions">
                <button
                  type="button"
                  className="secondary-action"
                  disabled={isWriting}
                  onClick={() => void handleVote('A')}
                >
                  Vote A
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={isWriting}
                  onClick={() => void handleVote('B')}
                >
                  Vote B
                </button>
              </div>
            ) : (
              <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
            )
          ) : null}
          <p className="sheets-meta">Total votes: {activePoll.total_votes ?? 0}</p>
          {activePoll.winning_option ? (
            <p className="sheets-meta">Winning option: {activePoll.winning_option}</p>
          ) : null}
          {writeError ? <p className="sheets-error">{writeError}</p> : null}
        </>
      ) : (
        <p>{fallbackBody}</p>
      )}
    </article>
  )
}

function BucketListCard({
  title,
  fallbackBody,
  canWrite,
  idToken,
}: {
  title: string
  fallbackBody: string
  canWrite: boolean
  idToken: string
}) {
  const [rows, setRows] = useState<BucketListRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')

  async function loadBucketList() {
    try {
      const data = await getBucketList()
      setRows(data)
    } catch {
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadBucketList()
  }, [])

  const visibleRows = rows.length > 0 ? rows : parseBucketFallback(fallbackBody)

  async function handleToggle(row: BucketListRecord) {
    if (!idToken || row.bucket_id.startsWith('fallback-') || isWriting) {
      return
    }

    const previousRows = rows
    const nextCompleted = !row.completed
    setIsWriting(true)
    setWriteError('')
    setRows((currentRows) =>
      currentRows.map((currentRow) =>
        currentRow.bucket_id === row.bucket_id
          ? {
              ...currentRow,
              completed: nextCompleted,
              completed_date: nextCompleted ? new Date().toISOString() : '',
            }
          : currentRow,
      ),
    )

    try {
      await setBucketCompleted(idToken, row.bucket_id, nextCompleted)
      void loadBucketList()
    } catch (error) {
      setRows(previousRows)
      setWriteError(error instanceof Error ? error.message : 'Unable to update bucket list item')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <article className="info-card section-page-card sheets-card">
      <h3>{title}</h3>
      {isLoading ? <p className="sheets-meta">Loading list...</p> : null}

      <ul className="sheets-list">
        {visibleRows.map((row) => (
          <li key={row.bucket_id} className={`sheets-item ${row.completed ? 'completed' : ''}`}>
            <div className="sheets-row">
              <span>
                {row.item}
                {row.completed_date ? <span className="sheets-date"> ({row.completed_date})</span> : null}
              </span>
              {canWrite && !row.bucket_id.startsWith('fallback-') ? (
                <button
                  type="button"
                  className="secondary-action"
                  disabled={!idToken || isWriting}
                  onClick={() => void handleToggle(row)}
                >
                  {row.completed ? 'Mark Incomplete' : 'Mark Complete'}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {canWrite && !idToken ? (
        <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
      ) : null}
      {writeError ? <p className="sheets-error">{writeError}</p> : null}
    </article>
  )
}

function CountriesCard({
  title,
  fallbackBody,
  canWrite,
  idToken,
}: {
  title: string
  fallbackBody: string
  canWrite: boolean
  idToken: string
}) {
  const [rows, setRows] = useState<CountryRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')

  async function loadCountries() {
    try {
      const data = await getCountries()
      setRows(data)
    } catch {
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCountries()
  }, [])

  const visited = rows
    .filter((row) => row.visited)
    .sort((a, b) => a.country_state_name.localeCompare(b.country_state_name))

  async function handleToggle(row: CountryRecord) {
    if (!idToken || isWriting) {
      return
    }

    const previousRows = rows
    const nextVisited = !row.visited
    setIsWriting(true)
    setWriteError('')
    setRows((currentRows) =>
      currentRows.map((currentRow) =>
        currentRow.country_id === row.country_id
          ? {
              ...currentRow,
              visited: nextVisited,
              visited_date: nextVisited ? new Date().toISOString() : '',
            }
          : currentRow,
      ),
    )

    try {
      await setCountryVisited(idToken, row.country_id, nextVisited)
      void loadCountries()
    } catch (error) {
      setRows(previousRows)
      setWriteError(error instanceof Error ? error.message : 'Unable to update country status')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <article className="info-card section-page-card sheets-card">
      <h3>{title}</h3>
      {isLoading ? <p className="sheets-meta">Loading places...</p> : null}

      {visited.length > 0 ? (
        <ul className="sheets-list">
          {visited.map((row) => (
            <li key={row.country_id} className="sheets-item">
              <div className="sheets-row">
                <span>
                  {row.country_state_name}
                  {row.visited_date ? <span className="sheets-date"> ({row.visited_date})</span> : null}
                </span>
                {canWrite ? (
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={!idToken || isWriting}
                    onClick={() => void handleToggle(row)}
                  >
                    Mark Unvisited
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>{fallbackBody}</p>
      )}

      {canWrite && rows.length > 0 ? (
        <ul className="sheets-list">
          {rows.filter((row) => !row.visited).map((row) => (
            <li key={`${row.country_id}-pending`} className="sheets-item">
              <div className="sheets-row">
                <span>{row.country_state_name}</span>
                <button
                  type="button"
                  className="secondary-action"
                  disabled={!idToken || isWriting}
                  onClick={() => void handleToggle(row)}
                >
                  Mark Visited
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {canWrite && !idToken ? (
        <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
      ) : null}
      {writeError ? <p className="sheets-error">{writeError}</p> : null}
    </article>
  )
}

function toLocalDateTimeInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

function getCountdownParts(targetDateTime: string, nowMs: number) {
  const targetMs = new Date(targetDateTime).getTime()
  if (!targetDateTime || Number.isNaN(targetMs) || targetMs <= nowMs) {
    return {
      months: 0,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
    }
  }

  let totalSeconds = Math.floor((targetMs - nowMs) / 1000)
  const monthSeconds = 30 * 24 * 60 * 60
  const daySeconds = 24 * 60 * 60
  const hourSeconds = 60 * 60

  const months = Math.floor(totalSeconds / monthSeconds)
  totalSeconds -= months * monthSeconds

  const days = Math.floor(totalSeconds / daySeconds)
  totalSeconds -= days * daySeconds

  const hours = Math.floor(totalSeconds / hourSeconds)
  totalSeconds -= hours * hourSeconds

  const minutes = Math.floor(totalSeconds / 60)
  totalSeconds -= minutes * 60

  return {
    months,
    days,
    hours,
    minutes,
    seconds: totalSeconds,
    totalMs: targetMs - nowMs,
  }
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function NextEventCountdownCard({
  title,
  canEdit,
}: {
  title: string
  canEdit: boolean
}) {
  const defaultDate = new Date('June 1, 2026 06:00:00')
  const [eventTitle, setEventTitle] = useState('10K')
  const [targetDateTime, setTargetDateTime] = useState(() => toLocalDateTimeInputValue(defaultDate))
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const parts = getCountdownParts(targetDateTime, nowMs)
  const isFinished = parts.totalMs <= 0
  const targetLabel = targetDateTime ? new Date(targetDateTime).toLocaleString() : 'Set a date'

  return (
    <article className="info-card section-page-card countdown-card">
      <h3>{title}</h3>

      {canEdit ? (
        <div className="countdown-inputs">
          <label>
            <span>Event title</span>
            <input
              type="text"
              value={eventTitle}
              onChange={(event) => setEventTitle(event.target.value)}
              placeholder="Race day, meet, hike, etc."
            />
          </label>

          <label>
            <span>Event date</span>
            <input
              type="datetime-local"
              value={targetDateTime}
              onChange={(event) => setTargetDateTime(event.target.value)}
            />
          </label>
        </div>
      ) : null}

      <p className="countdown-title">{eventTitle || 'Untitled event'}</p>
      <p className="countdown-target">Target: {targetLabel}</p>

      <div className="countdown-grid" aria-live="polite">
        <div className="countdown-cell">
          <strong>{pad2(parts.months)}</strong>
          <small>MM</small>
        </div>
        <div className="countdown-cell">
          <strong>{pad2(parts.days)}</strong>
          <small>DD</small>
        </div>
        <div className="countdown-cell">
          <strong>{pad2(parts.hours)}</strong>
          <small>HH</small>
        </div>
        <div className="countdown-cell">
          <strong>{pad2(parts.minutes)}</strong>
          <small>MM</small>
        </div>
        <div className="countdown-cell">
          <strong>{pad2(parts.seconds)}</strong>
          <small>SS</small>
        </div>
      </div>

      {isFinished ? (
        <p className="countdown-complete">Your event countdown is complete.</p>
      ) : null}
    </article>
  )
}

function ActuaryExamsCard({ title }: { title: string }) {
  return (
    <article className="info-card section-page-card experience-card">
      <h3>{title}</h3>
      <ul className="experience-list">
        {actuaryExamEntries.map((entry) => (
          <ActuaryExamRow
            key={`${entry.exam}-${entry.topic}`}
            entry={entry}
          />
        ))}
      </ul>
    </article>
  )
}

function ActuaryExamRow({ entry }: { entry: ActuaryExamEntry }) {
  return (
    <li className="experience-item">
      <p className="experience-role">{entry.exam} - {entry.topic}</p>
      <p className="experience-date">{entry.status}</p>
    </li>
  )
}

function EducationCard({ title }: { title: string }) {
  return (
    <article className="info-card section-page-card experience-card">
      <h3>{title}</h3>
      <ul className="experience-list">
        {educationEntries.map((entry) => (
          <EducationRow
            key={`${entry.degree}-${entry.institution}`}
            entry={entry}
          />
        ))}
      </ul>
    </article>
  )
}

function EducationRow({ entry }: { entry: EducationEntry }) {
  return (
    <li className="experience-item">
      <p className="experience-role">{entry.degree} - {entry.institution}</p>
      <p className="experience-date">{entry.date}</p>
    </li>
  )
}

const monthNameToIndex: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
}

function parseMonthYear(value: string): Date | null {
  const parts = value.trim().split(/\s+/)
  if (parts.length < 2) {
    return null
  }

  const month = monthNameToIndex[parts[0].toLowerCase()]
  const year = Number(parts[1])
  if (month === undefined || Number.isNaN(year)) {
    return null
  }

  return new Date(year, month, 1)
}

function getDateRange(rawDate: string) {
  const cleaned = rawDate.includes(',') ? rawDate.split(',').pop()?.trim() ?? rawDate : rawDate
  const [startRaw, endRaw] = cleaned.split(' - ').map((part) => part.trim())

  const startDate = parseMonthYear(startRaw)
  const endDate = endRaw?.toLowerCase() === 'present' ? new Date() : parseMonthYear(endRaw ?? '')

  return {
    startDate,
    endDate,
    sortDate: endRaw?.toLowerCase() === 'present' ? new Date() : endDate,
  }
}

function formatDuration(rawDate: string): string {
  const { startDate, endDate } = getDateRange(rawDate)
  if (!startDate || !endDate) {
    return ''
  }

  let monthsTotal = (endDate.getFullYear() - startDate.getFullYear()) * 12
  monthsTotal += endDate.getMonth() - startDate.getMonth()

  if (monthsTotal < 0) {
    monthsTotal = Math.abs(monthsTotal)
  }

  const years = Math.floor(monthsTotal / 12)
  const months = monthsTotal % 12
  const yearLabel = years === 1 ? 'yr' : 'yrs'
  const monthLabel = months === 1 ? 'mo' : 'mos'

  if (years > 0 && months > 0) {
    return ` (${years} ${yearLabel}, ${months} ${monthLabel})`
  }

  if (years > 0) {
    return ` (${years} ${yearLabel})`
  }

  return ` (${months} ${monthLabel})`
}

function ProfessionalExperienceCard({ title }: { title: string }) {
  const [viewMode, setViewMode] = useState<'technical' | 'all'>('technical')

  const visibleEntries =
    viewMode === 'all'
      ? [...professionalExperienceEntries].sort((a, b) => {
          const aRange = getDateRange(a.date)
          const bRange = getDateRange(b.date)
          const aTime = aRange.sortDate?.getTime() ?? 0
          const bTime = bRange.sortDate?.getTime() ?? 0
          return bTime - aTime
        })
      : professionalExperienceEntries.filter((entry) => entry.category === 'technical')

  return (
    <article className="info-card section-page-card experience-card">
      <h3>{title}</h3>

      <div className="experience-toggle" role="tablist" aria-label="Professional experience filter">
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'technical'}
          className={`experience-toggle-btn ${viewMode === 'technical' ? 'active' : ''}`}
          onClick={() => setViewMode('technical')}
        >
          Technical
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'all'}
          className={`experience-toggle-btn ${viewMode === 'all' ? 'active' : ''}`}
          onClick={() => setViewMode('all')}
        >
          All Experience
        </button>
      </div>

      <ul className="experience-list">
        {visibleEntries.map((entry) => (
          <ExperienceRow
            key={`${entry.position}-${entry.company}`}
            entry={entry}
            showDuration={true}
          />
        ))}
      </ul>
    </article>
  )
}

function ExperienceRow({
  entry,
  showDuration,
}: {
  entry: ProfessionalExperienceEntry
  showDuration: boolean
}) {
  const dateLabel = `${entry.date}${showDuration ? formatDuration(entry.date) : ''}`

  return (
    <li className="experience-item">
      <p className="experience-role">{entry.position} - {entry.company}</p>
      <p className="experience-date">{dateLabel}</p>
      {entry.note ? <p className="experience-note">{entry.note}</p> : null}
    </li>
  )
}

function MilestonesCard({ title, canEdit }: { title: string; canEdit: boolean }) {
  const [category, setCategory] = useState<'lifting' | 'running' | 'ironman' | 'etc'>('lifting')

  const visibleEntries = milestoneEntries.filter((entry) => entry.category === category)

  const categoryLabels: Record<'lifting' | 'running' | 'ironman' | 'etc', string> = {
    lifting: 'Lifting',
    running: 'Running',
    ironman: 'Ironman',
    etc: 'Etc',
  }

  return (
    <article className="info-card section-page-card milestones-card">
      <h3>{title}</h3>

      <div className="milestones-toggle" role="tablist" aria-label="Milestones category filter">
        {Object.entries(categoryLabels).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={category === key}
            className={`milestones-toggle-btn ${category === key ? 'active' : ''}`}
            onClick={() => setCategory(key as typeof category)}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="milestones-list">
        {visibleEntries.map((entry) => (
          <MilestoneRow key={`${entry.name}-${entry.category}`} entry={entry} canEdit={canEdit} />
        ))}
      </ul>
    </article>
  )
}

function MilestoneRow({
  entry,
  canEdit,
}: {
  entry: MilestoneEntry
  canEdit: boolean
}) {
  return (
    <li className="milestone-item">
      <div className="milestone-content">
        <p className="milestone-name">{entry.name}</p>
        {canEdit ? (
          <input
            type="text"
            className="milestone-value-input"
            value={entry.value}
            placeholder="Enter value..."
            onChange={(e) => {
              const index = milestoneEntries.findIndex(
                (m) => m.name === entry.name && m.category === entry.category,
              )
              if (index !== -1) {
                milestoneEntries[index].value = e.target.value
              }
            }}
          />
        ) : (
          <p className="milestone-value">{entry.value || '—'}</p>
        )}
      </div>
    </li>
  )
}

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(120, Math.max(1, Math.round(value)))
}

function PomodoroTimerCard({ title, body }: { title: string; body: string }) {
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [mode, setMode] = useState<'focus' | 'break'>('focus')
  const [isRunning, setIsRunning] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(25 * 60)
  const [hourglassCycle, setHourglassCycle] = useState(0)
  const [isPreFlip, setIsPreFlip] = useState(false)
  const [isUpright, setIsUpright] = useState(false)
  const flipResetTimerRef = useRef<number | null>(null)
  const hasStartedSinceResetRef = useRef(false)

  const totalSeconds = (mode === 'focus' ? focusMinutes : breakMinutes) * 60
  const progressRatio = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0
  const clampedProgress = Math.min(1, Math.max(0, progressRatio))
  const topSand = Math.round((1 - clampedProgress) * 100)
  const bottomSand = Math.round(clampedProgress * 100)
  const displayTopSand = topSand
  const displayBottomSand = bottomSand

  function clearHourglassAnimationTimer() {
    if (flipResetTimerRef.current !== null) {
      window.clearTimeout(flipResetTimerRef.current)
      flipResetTimerRef.current = null
    }
  }

  function restartHourglassAnimation() {
    clearHourglassAnimationTimer()

    setIsUpright(true)
    setIsPreFlip(true)
    setHourglassCycle((previous) => previous + 1)

    flipResetTimerRef.current = window.setTimeout(() => {
      setIsPreFlip(false)
      flipResetTimerRef.current = null
    }, 940)
  }

  useEffect(() => {
    if (!isRunning) {
      return
    }

    const timer = window.setInterval(() => {
      setSecondsLeft((previous) => {
        if (previous <= 1) {
          return 0
        }

        return previous - 1
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [isRunning])

  useEffect(() => {
    if (!isRunning || secondsLeft !== 0) {
      return
    }

    const nextMode = mode === 'focus' ? 'break' : 'focus'
    const nextSeconds = (nextMode === 'focus' ? focusMinutes : breakMinutes) * 60
    restartHourglassAnimation()
    setMode(nextMode)
    setSecondsLeft(nextSeconds)
  }, [secondsLeft, isRunning, mode, focusMinutes, breakMinutes])

  useEffect(() => {
    return () => {
      if (flipResetTimerRef.current !== null) {
        window.clearTimeout(flipResetTimerRef.current)
      }
    }
  }, [])

  function updateFocus(value: string) {
    const nextValue = clampMinutes(Number(value))
    setFocusMinutes(nextValue)

    if (!isRunning && mode === 'focus') {
      setSecondsLeft(nextValue * 60)
    }
  }

  function updateBreak(value: string) {
    const nextValue = clampMinutes(Number(value))
    setBreakMinutes(nextValue)

    if (!isRunning && mode === 'break') {
      setSecondsLeft(nextValue * 60)
    }
  }

  function switchMode(nextMode: 'focus' | 'break') {
    restartHourglassAnimation()
    hasStartedSinceResetRef.current = false
    setIsUpright(false)
    setMode(nextMode)
    setIsRunning(false)
    setSecondsLeft((nextMode === 'focus' ? focusMinutes : breakMinutes) * 60)
  }

  function resetTimer() {
    clearHourglassAnimationTimer()
    setIsPreFlip(false)
    setIsUpright(false)
    hasStartedSinceResetRef.current = false
    setIsRunning(false)
    setSecondsLeft((mode === 'focus' ? focusMinutes : breakMinutes) * 60)
  }

  function toggleRunning() {
    if (!isRunning) {
      if (!hasStartedSinceResetRef.current) {
        restartHourglassAnimation()
        hasStartedSinceResetRef.current = true
      }
    }

    setIsRunning((value) => !value)
  }

  return (
    <article className="info-card pomodoro-card">
      <div className="pomodoro-header">
        <h3>{title}</h3>
        <button
          type="button"
          className="pomodoro-collapse-btn"
          aria-expanded={!isCollapsed}
          aria-controls="pomodoro-panel"
          onClick={() => setIsCollapsed((value) => !value)}
        >
          {isCollapsed ? 'Show Timer' : 'Hide Timer'}
        </button>
      </div>

      <p>{body}</p>

      {!isCollapsed ? (
        <div id="pomodoro-panel" className="pomodoro-panel">
          <div className="pomodoro-settings" role="group" aria-label="Pomodoro duration settings">
            <label>
              <span>Focus (min)</span>
              <input
                type="number"
                min={1}
                max={120}
                value={focusMinutes}
                onChange={(event) => updateFocus(event.target.value)}
              />
            </label>
            <label>
              <span>Break (min)</span>
              <input
                type="number"
                min={1}
                max={120}
                value={breakMinutes}
                onChange={(event) => updateBreak(event.target.value)}
              />
            </label>
          </div>

          <div
            key={`${mode}-${isRunning ? 'running' : 'paused'}-${hourglassCycle}`}
            className={`pomodoro-hourglass ${isRunning ? 'running' : ''} ${isUpright ? 'upright' : ''} ${isPreFlip ? 'preflip' : ''}`}
            style={{ '--sand-top': `${displayTopSand}%`, '--sand-bottom': `${displayBottomSand}%` } as CSSProperties}
            aria-hidden="true"
          >
            <div className="hourglass-chamber top">
              <span className="hourglass-sand top" />
            </div>
            <span className="hourglass-stream" />
            <div className="hourglass-chamber bottom">
              <span className="hourglass-sand bottom" />
            </div>
          </div>

          <p className="pomodoro-status">{mode === 'focus' ? 'Focus Session' : 'Break Session'}</p>
          <p className="pomodoro-time" aria-live="polite">{formatClock(secondsLeft)}</p>

          <div className="pomodoro-mode-toggle" role="tablist" aria-label="Pomodoro mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'focus'}
              className={`experience-toggle-btn ${mode === 'focus' ? 'active' : ''}`}
              onClick={() => switchMode('focus')}
            >
              Focus
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'break'}
              className={`experience-toggle-btn ${mode === 'break' ? 'active' : ''}`}
              onClick={() => switchMode('break')}
            >
              Break
            </button>
          </div>

          <div className="pomodoro-controls">
            <button type="button" className="primary-action" onClick={toggleRunning}>
              {isRunning ? 'Pause' : 'Start'}
            </button>
            <button type="button" className="secondary-action" onClick={resetTimer}>
              Reset
            </button>
          </div>
        </div>
      ) : (
        <p className="pomodoro-collapsed-meta">
          {mode === 'focus' ? 'Focus' : 'Break'} | {formatClock(secondsLeft)}
        </p>
      )}
    </article>
  )
}

function DetailPage({ path }: { path: string }) {
  const page = detailPages[path]
  const parentPath = path.split('/').slice(0, 2).join('/')
  const parentSection = navSections.find((section) => section.path === parentPath)

  if (!page || !parentSection) {
    return <Navigate replace to="/" />
  }

  return (
    <PageFrame
      eyebrow={page.eyebrow}
      title={page.title}
      summary={page.summary}
      accent={page.accent}
      backLink={parentSection.path}
      backLabel={`Back to ${parentSection.title}`}
      note={page.note}
    >
      {page.cards.map((card) => {
        if (path === '/experiences/studying' && card.title === 'Pomodoro Timer') {
          return <PomodoroTimerCard key={card.title} title={card.title} body={card.body} />
        }

        if (path === '/training/records' && card.title === 'Milestones') {
          return <MilestonesCard key={card.title} title={card.title} canEdit={false} />
        }

        return (
          <article key={card.title} className="info-card">
            <h3>{card.title}</h3>
            <p>{card.body}</p>
          </article>
        )
      })}
    </PageFrame>
  )
}

function LoginPage({
  profile,
  onSwitchProfile,
  googleIdToken,
  onGoogleTokenChange,
}: {
  profile: UserProfile
  onSwitchProfile: (profile: UserProfile) => void
  googleIdToken: string
  onGoogleTokenChange: (token: string) => void
}) {
  const navigate = useNavigate()

  function handleGoogleSuccess(response: CredentialResponse) {
    const token = response.credential ?? ''
    if (token) {
      onGoogleTokenChange(token)
    }
  }

  return (
    <section className="page auth-page">
      <PageFrame
        eyebrow="Access"
        title="Login"
        summary="Select a demo profile for role-based permissions on editable widgets."
        accent="#7a62ff"
        backLink="/"
        backLabel="Back home"
        note=""
      >
        <div className="login-card">
          <p className="summary-line">Current profile: {profile.toUpperCase()}</p>
          <div className="google-auth-block">
            <p className="summary-line">Google auth: {googleIdToken ? 'Connected' : 'Not connected'}</p>
            {googleClientConfigured && !googleIdToken ? (
              <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => onGoogleTokenChange('')} />
            ) : !googleClientConfigured ? (
              <p className="sheets-meta">Set VITE_GOOGLE_CLIENT_ID in .env to enable Google Sign-In.</p>
            ) : null}
            {googleIdToken ? (
              <button
                type="button"
                className="secondary-action"
                onClick={() => onGoogleTokenChange('')}
              >
                Sign Out Google Session
              </button>
            ) : null}
          </div>
          <div className="profile-switch-grid">
            <article className={`profile-option ${profile === 'guest' ? 'active' : ''}`}>
              <h3>Guest</h3>
              <p>View-only profile. Countdown title and date are locked.</p>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  onSwitchProfile('guest')
                  navigate('/training')
                }}
              >
                Use Guest Profile
              </button>
            </article>

            <article className={`profile-option ${profile === 'admin' ? 'active' : ''}`}>
              <h3>Admin</h3>
              <p>Editable profile. You can update event title and event date.</p>
              <button
                type="button"
                className="primary-action"
                onClick={() => {
                  onSwitchProfile('admin')
                  navigate('/training')
                }}
              >
                Use Admin Profile
              </button>
            </article>
          </div>
        </div>
      </PageFrame>
    </section>
  )
}

function PageFrame({
  eyebrow,
  title,
  summary,
  accent,
  backLink,
  backLabel,
  note,
  downloadPdfHref,
  downloadWordHref,
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

      <section className="page-grid">{children}</section>
    </div>
  )
}

export default App
