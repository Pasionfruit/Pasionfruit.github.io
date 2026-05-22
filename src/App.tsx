import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
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
import { feature } from 'topojson-client'
import type { Topology } from 'topojson-specification'
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
  createBucketItem,
  createCountry,
  createEvent,
  createPoll,
  deleteBucketItem,
  deleteCountry,
  deleteEvent,
  deletePoll,
  getBackpackItems,
  getBucketList,
  getCurrentStudy,
  getCountries,
  getEvents,
  getMealPlan,
  getPolls,
  getTrainingRecords,
  setActiveEvent,
  setBucketCompleted,
  setCountryVisited,
  setCurrentStudyCompleted,
  setTrainingWorkoutCompleted,
  updateBucketItem,
  updateCountry,
  updateEvent,
  updateBackpackItem,
  updateMealPlan,
  votePoll,
} from './data/sheets/repositories'
import type {
  BackpackRecord,
  BucketListRecord,
  CountryRecord,
  CurrentStudyRecord,
  EventRecord,
  MealPlanRecord,
  PollRecord,
  TrainingRecord,
} from './data/sheets/types'
import { closeTask, createTask, getTasksOfTheDay, updateTask } from './data/todoist/repositories'
import type { TodoistTask } from './data/todoist/types'

type ThemeMode = 'light' | 'dark'
type UserProfile = 'guest' | 'admin'
const TODOIST_EDITOR_EMAIL = 'pasionabe@gmail.com'

const googleClientConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim())

function isTodoistConfigured() {
  return Boolean(import.meta.env.VITE_TODOIST_API_TOKEN?.trim())
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) {
      return null
    }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const json = window.atob(base64)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return null
  }
}

function isExpiredGoogleIdToken(token: string) {
  const payload = decodeJwtPayload(token)
  const exp = typeof payload?.exp === 'number' ? payload.exp : undefined
  if (!exp) {
    return false
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  return exp <= nowSeconds
}

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

  const token = window.localStorage.getItem('google-id-token') ?? ''
  if (!token) {
    return ''
  }

  if (isExpiredGoogleIdToken(token)) {
    window.localStorage.removeItem('google-id-token')
    return ''
  }

  return token
}

function getActiveSectionId(pathname: string): SectionId | undefined {
  return navSections.find(
    (section) => pathname === section.path || pathname.startsWith(`${section.path}/`),
  )?.id
}

function getGoogleTokenEmail(token: string) {
  const payload = decodeJwtPayload(token)
  const email = payload?.email
  return typeof email === 'string' ? email.toLowerCase().trim() : ''
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
        <Route index element={<HomePage profile={profile} googleIdToken={googleIdToken} />} />
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
        <Route
          path="experiences/studying"
          element={<DetailPage path="/experiences/studying" profile={profile} googleIdToken={googleIdToken} />}
        />
        <Route path="experience/studying" element={<Navigate replace to="/experiences/studying" />} />
        <Route
          path="cooking"
          element={<SectionPage sectionId="cooking" profile={profile} googleIdToken={googleIdToken} />}
        />
        <Route
          path="cooking/recipes"
          element={<DetailPage path="/cooking/recipes" profile={profile} googleIdToken={googleIdToken} />}
        />
        <Route
          path="cooking/plan"
          element={<DetailPage path="/cooking/plan" profile={profile} googleIdToken={googleIdToken} />}
        />
        <Route
          path="cooking/learn"
          element={<DetailPage path="/cooking/learn" profile={profile} googleIdToken={googleIdToken} />}
        />
        <Route
          path="cooking/deals"
          element={<DetailPage path="/cooking/deals" profile={profile} googleIdToken={googleIdToken} />}
        />
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
            const hasChildren = section.children.length > 0
            const isExpanded = hasChildren && expandedSectionIds.includes(section.id)

            return (
              <div key={section.id} className="menu-section-card">
                <div className="menu-section-row">
                  {hasChildren ? (
                    <button
                      type="button"
                      className="menu-expander"
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${section.title}`}
                      aria-expanded={isExpanded}
                      onClick={() => toggleSection(section.id)}
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  ) : null}

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

                {hasChildren && isExpanded ? (
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

function HomePage({ profile, googleIdToken }: { profile: UserProfile; googleIdToken: string }) {
  return (
    <div className="page home-page">
      <TodoistTasksCard title="Tasks of the Day" profile={profile} googleIdToken={googleIdToken} />
      <HomeDailyFocusCard profile={profile} googleIdToken={googleIdToken} />
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

function HomeDailyFocusCard({ profile, googleIdToken }: { profile: UserProfile; googleIdToken: string }) {
  const googleEmail = getGoogleTokenEmail(googleIdToken)
  const canWrite = profile === 'admin' && googleEmail === TODOIST_EDITOR_EMAIL
  const [view, setView] = useState<'training' | 'studying'>('training')
  const [trainingRows, setTrainingRows] = useState<TrainingRecord[]>([])
  const [studyRows, setStudyRows] = useState<CurrentStudyRecord[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')

  async function loadDailyData() {
    try {
      const [trainingData, studyData] = await Promise.all([getTrainingRecords(), getCurrentStudy()])
      setTrainingRows(trainingData)
      setStudyRows(studyData)
      setWriteError('')
    } catch {
      setTrainingRows([])
      setStudyRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadDailyData()
  }, [])

  const todayKey = toDateOnlyKey(new Date().toISOString())

  const todaysTrainingRecord = useMemo(
    () => trainingRows.find((row) => toDateOnlyKey(row.date) === todayKey),
    [trainingRows, todayKey],
  )

  const todaysLessons = useMemo(() => {
    return studyRows
      .filter((row) => {
        if (toDateOnlyKey(row.date) !== todayKey) {
          return false
        }

        const topic = row.topic.trim()
        if (!topic) {
          return false
        }

        if (topic.toLowerCase() === 'rest day') {
          return false
        }

        if (/^take sample exam #\d+$/i.test(topic)) {
          return false
        }

        if (/^attempt \d+ problems$/i.test(topic)) {
          return false
        }

        return true
      })
      .sort((a, b) => a.topic.localeCompare(b.topic))
  }, [studyRows, todayKey])

  async function handleToggleTrainingWorkout(period: 'morning' | 'evening') {
    if (!canWrite || !googleIdToken || !todaysTrainingRecord || isWriting) {
      return
    }

    const isMorning = period === 'morning'
    const nextCompleted = isMorning
      ? !todaysTrainingRecord.completed_morning
      : !todaysTrainingRecord.completed_evening
    const previousRows = trainingRows

    setIsWriting(true)
    setWriteError('')
    setTrainingRows((currentRows) =>
      currentRows.map((row) => {
        if (row.training_id !== todaysTrainingRecord.training_id) {
          return row
        }

        if (isMorning) {
          return { ...row, completed_morning: nextCompleted }
        }

        return { ...row, completed_evening: nextCompleted }
      }),
    )

    try {
      await setTrainingWorkoutCompleted(googleIdToken, todaysTrainingRecord.training_id, period, nextCompleted)
      await loadDailyData()
    } catch (error) {
      setTrainingRows(previousRows)
      setWriteError(error instanceof Error ? error.message : 'Unable to update workout completion state')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleToggleStudyLesson(row: CurrentStudyRecord) {
    if (!canWrite || !googleIdToken || isWriting) {
      return
    }

    const previousRows = studyRows
    const nextCompleted = !row.completed
    setIsWriting(true)
    setWriteError('')
    setStudyRows((currentRows) =>
      currentRows.map((currentRow) =>
        currentRow.study_id === row.study_id ? { ...currentRow, completed: nextCompleted } : currentRow,
      ),
    )

    try {
      await setCurrentStudyCompleted(googleIdToken, row.study_id, nextCompleted)
      await loadDailyData()
    } catch (error) {
      setStudyRows(previousRows)
      setWriteError(error instanceof Error ? error.message : 'Unable to update completion state')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <article className="info-card home-daily-focus-card sheets-card">
      <div className="section-card-header">
        <h3>Productive Tasks</h3>
        <button
          type="button"
          className="section-collapse-btn"
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((value) => !value)}
        >
          {isCollapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!isCollapsed ? (
        <>
          <div className="experience-toggle" role="tablist" aria-label="Daily focus filter">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'training'}
              className={`experience-toggle-btn ${view === 'training' ? 'active' : ''}`}
              onClick={() => setView('training')}
            >
              Training
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'studying'}
              className={`experience-toggle-btn ${view === 'studying' ? 'active' : ''}`}
              onClick={() => setView('studying')}
            >
              Studying
            </button>
          </div>

          {isLoading ? <p className="sheets-meta">Loading tasks...</p> : null}

          {!isLoading && view === 'training' ? (
            <>
              <p className="sheets-meta">Workout(s) of the Day</p>
              {todaysTrainingRecord ? (
                <div className="study-today-shell">
                  <table className="study-today-table">
                    <thead>
                      <tr>
                        <th>Workout</th>
                        <th>Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{todaysTrainingRecord.morning_workout || 'Morning —'}</td>
                        <td className="study-complete-cell">
                          {canWrite ? (
                            <button
                              type="button"
                              className="secondary-action study-complete-btn"
                              onClick={() => void handleToggleTrainingWorkout('morning')}
                              disabled={!googleIdToken || isWriting}
                            >
                              {todaysTrainingRecord.completed_morning ? '✓ Completed' : 'Mark Complete'}
                            </button>
                          ) : (
                            <span>{todaysTrainingRecord.completed_morning ? '✓ Yes' : 'No'}</span>
                          )}
                        </td>
                      </tr>
                      <tr>
                        <td>{todaysTrainingRecord.evening_workout || 'Evening —'}</td>
                        <td className="study-complete-cell">
                          {canWrite ? (
                            <button
                              type="button"
                              className="secondary-action study-complete-btn"
                              onClick={() => void handleToggleTrainingWorkout('evening')}
                              disabled={!googleIdToken || isWriting}
                            >
                              {todaysTrainingRecord.completed_evening ? '✓ Completed' : 'Mark Complete'}
                            </button>
                          ) : (
                            <span>{todaysTrainingRecord.completed_evening ? '✓ Yes' : 'No'}</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="sheets-meta">No workout scheduled for today.</p>
              )}
            </>
          ) : null}

          {!isLoading && view === 'studying' ? (
            <>
              <p className="sheets-meta">Today's Lesson</p>
              {todaysLessons.length > 0 ? (
                <div className="study-today-shell">
                  <table className="study-today-table">
                    <thead>
                      <tr>
                        <th>Topic</th>
                        <th>Completed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todaysLessons.map((row) => (
                        <tr key={row.study_id}>
                          <td>{row.topic}</td>
                          <td className="study-complete-cell" aria-label={row.completed ? 'Completed' : 'Not completed'}>
                            {canWrite ? (
                              <button
                                type="button"
                                className="secondary-action study-complete-btn"
                                onClick={() => void handleToggleStudyLesson(row)}
                                disabled={!googleIdToken || isWriting}
                              >
                                {row.completed ? '✓ Completed' : 'Mark Complete'}
                              </button>
                            ) : row.completed ? (
                              '✓'
                            ) : (
                              ''
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="sheets-meta">No lesson scheduled for today.</p>
              )}
            </>
          ) : null}

          {!canWrite ? (
            <p className="sheets-meta">Edit access restricted to Admin profile signed in as {TODOIST_EDITOR_EMAIL}.</p>
          ) : null}

          {writeError ? <p className="sheets-error">{writeError}</p> : null}
        </>
      ) : null}
    </article>
  )
}

function dateForInput(value?: string | null) {
  if (!value) {
    return ''
  }

  const datePart = value.split('T')[0]
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

function displayDueDate(task: TodoistTask) {
  const raw = task.due?.date ?? task.due?.datetime
  if (!raw) {
    return 'No due date'
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return raw
  }

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function normalizePriority(value: number) {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(4, Math.max(1, Math.round(value)))
}

function TodoistTasksCard({
  title,
  profile,
  googleIdToken,
}: {
  title: string
  profile: UserProfile
  googleIdToken: string
}) {
  const todoistConfigured = isTodoistConfigured()
  const googleEmail = getGoogleTokenEmail(googleIdToken)
  const canEdit = profile === 'admin' && googleEmail === TODOIST_EDITOR_EMAIL
  const [rows, setRows] = useState<TodoistTask[]>([])
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [newTaskContent, setNewTaskContent] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState(1)
  const [editedRows, setEditedRows] = useState<Record<string, { content: string; description: string; dueDate: string; priority: number }>>({})

  async function loadTasks() {
    try {
      const data = await getTasksOfTheDay()
      setRows(data)
      setWriteError('')
    } catch (error) {
      setRows([])
      setWriteError(error instanceof Error ? error.message : 'Unable to load Todoist tasks')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!todoistConfigured) {
      setRows([])
      setIsLoading(false)
      return
    }

    void loadTasks()
  }, [])

  useEffect(() => {
    const next: Record<string, { content: string; description: string; dueDate: string; priority: number }> = {}
    rows.forEach((row) => {
      next[row.id] = {
        content: row.content,
        description: row.description ?? '',
        dueDate: dateForInput(row.due?.date ?? row.due?.datetime ?? ''),
        priority: normalizePriority(row.priority),
      }
    })
    setEditedRows(next)
  }, [rows])

  async function handleCreateTask() {
    if (isWriting || !todoistConfigured || !canEdit) {
      return
    }

    const content = newTaskContent.trim()
    if (!content) {
      setWriteError('Task content is required.')
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await createTask(content, newTaskDueDate || undefined, normalizePriority(newTaskPriority))
      setNewTaskContent('')
      setNewTaskDueDate('')
      setNewTaskPriority(1)
      await loadTasks()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to create task')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleSaveTask(task: TodoistTask) {
    if (isWriting || !todoistConfigured || !canEdit) {
      return
    }

    const draft = editedRows[task.id]
    const content = (draft?.content ?? task.content).trim()
    const description = (draft?.description ?? task.description ?? '').trim()
    const dueDate = draft?.dueDate ?? ''
    const priority = normalizePriority(draft?.priority ?? task.priority)

    if (!content) {
      setWriteError('Task content is required.')
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await updateTask(task.id, {
        content,
        description,
        dueDate: dueDate || undefined,
        priority,
      })
      await loadTasks()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to update task')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleCompleteTask(task: TodoistTask) {
    if (isWriting || !todoistConfigured || !canEdit) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await closeTask(task.id)
      await loadTasks()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to mark task complete')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <article className="info-card section-page-card sheets-card home-todoist-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          {canEdit ? (
            <button
              type="button"
              className={`section-edit-btn ${isEditing ? 'active' : ''}`}
              aria-pressed={isEditing}
              onClick={() => setIsEditing((value) => !value)}
              title="Edit values"
            >
              ✎
            </button>
          ) : null}
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            {isCollapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          <p className="sheets-meta">Scope: Today + overdue tasks from Todoist.</p>

          {!todoistConfigured ? (
            <p className="sheets-error">Set VITE_TODOIST_API_TOKEN in your .env file, then restart the app.</p>
          ) : null}

          {todoistConfigured && isLoading ? <p className="sheets-meta">Loading Todoist tasks...</p> : null}

          {!canEdit ? (
            <p className="sheets-meta">
              Edit access restricted to Admin profile signed in as {TODOIST_EDITOR_EMAIL}.
            </p>
          ) : null}

          {todoistConfigured && rows.length > 0 ? (
            <div className="sheets-table-shell">
              <table className="sheets-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`summary-${row.id}`}>
                      <td>
                        <p>{row.content}</p>
                        {row.description ? <p className="sheets-meta">{row.description}</p> : null}
                      </td>
                      <td>{row.is_completed ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {todoistConfigured && canEdit && isEditing ? (
            <div className="sheets-editor todoist-create-row">
              <div className="todoist-input-grid">
                <input
                  className="sheets-input"
                  type="text"
                  placeholder="New task"
                  value={newTaskContent}
                  onChange={(event) => setNewTaskContent(event.target.value)}
                  disabled={isWriting}
                />
                <input
                  className="sheets-input"
                  type="date"
                  value={newTaskDueDate}
                  onChange={(event) => setNewTaskDueDate(event.target.value)}
                  disabled={isWriting}
                />
                <select
                  className="sheets-input"
                  value={String(newTaskPriority)}
                  onChange={(event) => setNewTaskPriority(normalizePriority(Number(event.target.value)))}
                  disabled={isWriting}
                >
                  <option value="1">P1</option>
                  <option value="2">P2</option>
                  <option value="3">P3</option>
                  <option value="4">P4</option>
                </select>
              </div>
              <button
                type="button"
                className="secondary-action"
                onClick={() => void handleCreateTask()}
                disabled={isWriting}
              >
                Add Task
              </button>
            </div>
          ) : null}

          {todoistConfigured && canEdit && isEditing && rows.length > 0 ? (
            <div className="sheets-table-shell">
              <table className="sheets-table">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Due</th>
                    <th>Completed</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="todoist-row-fields">
                          <input
                            className="sheets-input sheets-table-input"
                            type="text"
                            value={editedRows[row.id]?.content ?? row.content}
                            onChange={(event) =>
                              setEditedRows((current) => ({
                                ...current,
                                [row.id]: {
                                  content: event.target.value,
                                  description: current[row.id]?.description ?? row.description ?? '',
                                  dueDate: current[row.id]?.dueDate ?? dateForInput(row.due?.date ?? row.due?.datetime),
                                  priority: current[row.id]?.priority ?? normalizePriority(row.priority),
                                },
                              }))
                            }
                            disabled={isWriting || !canEdit}
                          />
                          <textarea
                            className="sheets-input sheets-table-input"
                            value={editedRows[row.id]?.description ?? row.description ?? ''}
                            onChange={(event) =>
                              setEditedRows((current) => ({
                                ...current,
                                [row.id]: {
                                  content: current[row.id]?.content ?? row.content,
                                  description: event.target.value,
                                  dueDate: current[row.id]?.dueDate ?? dateForInput(row.due?.date ?? row.due?.datetime),
                                  priority: current[row.id]?.priority ?? normalizePriority(row.priority),
                                },
                              }))
                            }
                            disabled={isWriting || !canEdit}
                            rows={3}
                            placeholder="Task description"
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          className="sheets-input sheets-table-input"
                          type="date"
                          value={editedRows[row.id]?.dueDate ?? dateForInput(row.due?.date ?? row.due?.datetime)}
                          onChange={(event) =>
                            setEditedRows((current) => ({
                              ...current,
                              [row.id]: {
                                content: current[row.id]?.content ?? row.content,
                                description: current[row.id]?.description ?? row.description ?? '',
                                dueDate: event.target.value,
                                priority: current[row.id]?.priority ?? normalizePriority(row.priority),
                              },
                            }))
                          }
                          disabled={isWriting || !canEdit}
                        />
                        <p className="sheets-meta">{displayDueDate(row)}</p>
                      </td>
                      <td>{row.is_completed ? 'Yes' : 'No'}</td>
                      <td>
                        <div className="sheets-table-actions">
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() => void handleSaveTask(row)}
                            disabled={isWriting || !canEdit}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() => void handleCompleteTask(row)}
                            disabled={isWriting || !canEdit}
                          >
                            Complete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {todoistConfigured && !isLoading && rows.length === 0 && !writeError ? (
            <p className="sheets-meta">No tasks due today or overdue.</p>
          ) : null}

          {writeError ? <p className="sheets-error">{writeError}</p> : null}
        </>
      ) : null}
    </article>
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
        if (sectionId === 'mrpasionfruit' && card.title === 'Meet the Oreo Gang') {
          return <CollapsibleTextCard key={card.title} title={card.title} body={card.body} />
        }

        if (sectionId === 'mrpasionfruit' && card.title === 'Question of the Day') {
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

        if (sectionId === 'mrpasionfruit' && card.title === 'Backpack') {
          const googleEmail = getGoogleTokenEmail(googleIdToken)
          const canWrite = profile === 'admin' && googleEmail === TODOIST_EDITOR_EMAIL

          return (
            <BackpackCard
              key={card.title}
              title={card.title}
              fallbackBody={card.body}
              canWrite={canWrite}
              idToken={googleIdToken}
            />
          )
        }

        if (sectionId === 'cooking' && card.title === 'Meal Plan for the Day') {
          const googleEmail = getGoogleTokenEmail(googleIdToken)
          const canWrite = profile === 'admin' && googleEmail === TODOIST_EDITOR_EMAIL

          return (
            <MealPlanCard
              key={card.title}
              title={card.title}
              fallbackBody={card.body}
              canWrite={canWrite}
              idToken={googleIdToken}
              showTodaySummary
            />
          )
        }

        if (sectionId === 'training' && card.title === 'Next Event Countdown') {
          const googleEmail = getGoogleTokenEmail(googleIdToken)
          const canWrite = profile === 'admin' && googleEmail === TODOIST_EDITOR_EMAIL

          return <NextEventCountdownCard key={card.title} title={card.title} canWrite={canWrite} idToken={googleIdToken} />
        }

        if (sectionId === 'training' && card.title === 'Training Log') {
          const googleEmail = getGoogleTokenEmail(googleIdToken)
          const canWrite = profile === 'admin' && googleEmail === TODOIST_EDITOR_EMAIL

          return <TrainingLogCard key={card.title} title={card.title} canWrite={canWrite} idToken={googleIdToken} />
        }

        if (sectionId === 'training' && card.title === 'Workout(s) of the Day') {
          return <CollapsibleTextCard key={card.title} title={card.title} body={card.body} />
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

function CollapsibleTextCard({ title, body }: { title: string; body: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <article className="info-card section-page-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <button
          type="button"
          className="section-collapse-btn"
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((value) => !value)}
        >
          {isCollapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!isCollapsed ? <p>{body}</p> : null}
    </article>
  )
}

function CollapsibleSectionCard({
  title,
  className = '',
  children,
}: {
  title: string
  className?: string
  children: ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <article className={`info-card section-page-card ${className}`.trim()}>
      <div className="section-card-header">
        <h3>{title}</h3>
        <button
          type="button"
          className="section-collapse-btn"
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((value) => !value)}
        >
          {isCollapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!isCollapsed ? children : null}
    </article>
  )
}

function TechnicalSkillsCard({ title, body }: { title: string; body: string }) {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return (
    <CollapsibleSectionCard title={title} className="technical-skills-card">
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
    </CollapsibleSectionCard>
  )
}

function formatSheetDate(value?: string) {
  if (!value) {
    return 'Pending'
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [draftQuestion, setDraftQuestion] = useState('')
  const [draftOptionA, setDraftOptionA] = useState('')
  const [draftOptionB, setDraftOptionB] = useState('')
  const [votedPollIds, setVotedPollIds] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') {
      return {}
    }

    try {
      const raw = window.localStorage.getItem('voted-poll-ids')
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
    } catch {
      return {}
    }
  })

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

  const activePoll = [...rows].sort((a, b) => {
    const aTime = a.created_date ? new Date(a.created_date).getTime() : 0
    const bTime = b.created_date ? new Date(b.created_date).getTime() : 0
    return bTime - aTime
  })[0]

  const optionAVotes = activePoll?.option_a_votes ?? 0
  const optionBVotes = activePoll?.option_b_votes ?? 0
  const distributionTotalVotes = optionAVotes + optionBVotes
  const optionAPercent = distributionTotalVotes > 0 ? (optionAVotes / distributionTotalVotes) * 100 : 50
  const optionBPercent = 100 - optionAPercent
  const hasVotedActivePoll = activePoll ? Boolean(votedPollIds[activePoll.poll_id]) : false

  useEffect(() => {
    setDraftQuestion(activePoll?.question ?? '')
    setDraftOptionA(activePoll?.option_a ?? '')
    setDraftOptionB(activePoll?.option_b ?? '')
  }, [activePoll?.poll_id])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem('voted-poll-ids', JSON.stringify(votedPollIds))
  }, [votedPollIds])

  async function handleVote(selectedOption: 'A' | 'B') {
    if (!idToken || !activePoll || isWriting || hasVotedActivePoll) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await votePoll(idToken, activePoll.poll_id, selectedOption)
      setVotedPollIds((current) => ({ ...current, [activePoll.poll_id]: true }))
      await loadPolls()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to submit vote')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleSavePoll() {
    if (!idToken || isWriting) {
      return
    }

    const question = draftQuestion.trim()
    const optionA = draftOptionA.trim()
    const optionB = draftOptionB.trim()
    if (!question || !optionA || !optionB) {
      setWriteError('Question and both options are required.')
      return
    }

    setIsWriting(true)
    setWriteError('')

    try {
      await createPoll(idToken, question, optionA, optionB)
      await loadPolls()
      setIsEditing(false)
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to save poll')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleDeletePoll() {
    if (!idToken || !activePoll || isWriting) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await deletePoll(idToken, activePoll.poll_id)
      await loadPolls()
      setIsEditing(false)
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to delete poll')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <article className="info-card section-page-card sheets-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          {canWrite ? (
            <button
              type="button"
              className={`section-edit-btn ${isEditing ? 'active' : ''}`}
              aria-pressed={isEditing}
              onClick={() => setIsEditing((value) => !value)}
              title="Edit values"
            >
              ✎
            </button>
          ) : null}
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            {isCollapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          {isLoading ? <p className="sheets-meta">Loading poll...</p> : null}

          {activePoll ? (
            <>
              <p className="sheets-question">{activePoll.question}</p>
              <div className="poll-distribution" aria-label="Current vote distribution">
                <div className="poll-distribution-bar" role="img" aria-label="Current vote split">
                  <span
                    className="poll-distribution-segment poll-distribution-segment-a"
                    style={{ width: `${optionAPercent}%` }}
                  />
                  <span
                    className="poll-distribution-segment poll-distribution-segment-b"
                    style={{ width: `${optionBPercent}%` }}
                  />
                </div>
                <div className="poll-distribution-meta">
                  <span>
                    A: {activePoll.option_a} ({optionAVotes}) {Math.round(optionAPercent)}%
                  </span>
                  <span>
                    B: {activePoll.option_b} ({optionBVotes}) {Math.round(optionBPercent)}%
                  </span>
                </div>
              </div>
              <ul className="sheets-list">
                <li className="sheets-item">A: {activePoll.option_a} ({activePoll.option_a_votes ?? 0})</li>
                <li className="sheets-item">B: {activePoll.option_b} ({activePoll.option_b_votes ?? 0})</li>
              </ul>
              {!canWrite ? (
                idToken ? (
                  hasVotedActivePoll ? (
                    <p className="sheets-meta">You have already voted on this poll.</p>
                  ) : (
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
                  )
                ) : (
                  <p className="sheets-meta">Sign in with Google on Login page to vote.</p>
                )
              ) : null}
              <p className="sheets-meta">Total votes: {activePoll.total_votes ?? 0}</p>
              {activePoll.winning_option ? (
                <p className="sheets-meta">Winning option: {activePoll.winning_option}</p>
              ) : null}
            </>
          ) : (
            <p>{fallbackBody}</p>
          )}

          {canWrite && !idToken ? (
            <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
          ) : null}

          {canWrite && isEditing ? (
            <div className="sheets-editor">
              <label>
                <span className="sheets-meta">Question</span>
                <input
                  className="sheets-input"
                  type="text"
                  value={draftQuestion}
                  onChange={(event) => setDraftQuestion(event.target.value)}
                  disabled={!idToken || isWriting}
                />
              </label>
              <label>
                <span className="sheets-meta">Option A</span>
                <input
                  className="sheets-input"
                  type="text"
                  value={draftOptionA}
                  onChange={(event) => setDraftOptionA(event.target.value)}
                  disabled={!idToken || isWriting}
                />
              </label>
              <label>
                <span className="sheets-meta">Option B</span>
                <input
                  className="sheets-input"
                  type="text"
                  value={draftOptionB}
                  onChange={(event) => setDraftOptionB(event.target.value)}
                  disabled={!idToken || isWriting}
                />
              </label>
              <div className="sheets-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => void handleSavePoll()}
                  disabled={!idToken || isWriting}
                >
                  Add New Poll
                </button>
                {activePoll ? (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => void handleDeletePoll()}
                    disabled={!idToken || isWriting}
                  >
                    Delete Poll
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {writeError ? <p className="sheets-error">{writeError}</p> : null}
        </>
      ) : null}
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
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [newItem, setNewItem] = useState('')
  const [editedItems, setEditedItems] = useState<Record<string, string>>({})

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

  useEffect(() => {
    const next: Record<string, string> = {}
    rows.forEach((row) => {
      next[row.bucket_id] = row.item
    })
    setEditedItems(next)
  }, [rows])

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

  async function handleCreate() {
    if (!idToken || isWriting) {
      return
    }
    const item = newItem.trim()
    if (!item) {
      setWriteError('Item is required.')
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await createBucketItem(idToken, item)
      setNewItem('')
      await loadBucketList()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to create item')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleRename(row: BucketListRecord) {
    if (!idToken || isWriting || row.bucket_id.startsWith('fallback-')) {
      return
    }
    const item = (editedItems[row.bucket_id] ?? row.item).trim()
    if (!item) {
      setWriteError('Item is required.')
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await updateBucketItem(idToken, row.bucket_id, item)
      await loadBucketList()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to update item')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleDelete(row: BucketListRecord) {
    if (!idToken || isWriting || row.bucket_id.startsWith('fallback-')) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await deleteBucketItem(idToken, row.bucket_id)
      await loadBucketList()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to delete item')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <article className="info-card section-page-card sheets-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          {canWrite ? (
            <button
              type="button"
              className={`section-edit-btn ${isEditing ? 'active' : ''}`}
              aria-pressed={isEditing}
              onClick={() => setIsEditing((value) => !value)}
              title="Edit values"
            >
              ✎
            </button>
          ) : null}
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            {isCollapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          {isLoading ? <p className="sheets-meta">Loading list...</p> : null}

          <ol className="bucket-guest-list">
            {visibleRows.map((row) => (
              <li key={row.bucket_id} className={`bucket-guest-item ${row.completed ? 'completed' : ''}`}>
                <div className="bucket-guest-row">
                  <span>{row.item}</span>
                  <span className="bucket-guest-date">{formatSheetDate(row.completed_date)}</span>
                </div>
              </li>
            ))}
          </ol>

          {canWrite && isEditing ? (
            <div className="sheets-editor">
              <p className="sheets-meta">Edit bucket list</p>
              <div className="sheets-editor-row">
                <input
                  className="sheets-input"
                  type="text"
                  placeholder="New item"
                  value={newItem}
                  onChange={(event) => setNewItem(event.target.value)}
                  disabled={!idToken || isWriting}
                />
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => void handleCreate()}
                  disabled={!idToken || isWriting}
                >
                  Add
                </button>
              </div>

              {rows.map((row) => (
                <div key={`edit-${row.bucket_id}`} className="sheets-editor-row">
                  <input
                    className="sheets-input"
                    type="text"
                    value={editedItems[row.bucket_id] ?? row.item}
                    onChange={(event) =>
                      setEditedItems((current) => ({ ...current, [row.bucket_id]: event.target.value }))
                    }
                    disabled={!idToken || isWriting}
                  />
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => void handleRename(row)}
                    disabled={!idToken || isWriting}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => void handleToggle(row)}
                    disabled={!idToken || isWriting}
                  >
                    {row.completed ? 'Uncheck' : 'Check'}
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => void handleDelete(row)}
                    disabled={!idToken || isWriting}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {canWrite && !idToken ? (
            <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
          ) : null}
          {writeError ? <p className="sheets-error">{writeError}</p> : null}
        </>
      ) : null}
    </article>
  )
}

const WORLD_GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'
const SVG_W = 960
const SVG_H = 480

// Maps sheet names → world-atlas Natural Earth names (and reverse)
const COUNTRY_NAME_ALIASES: Record<string, string> = {
  // Americas
  'united states': 'united states of america',
  'usa': 'united states of america',
  // Europe
  'uk': 'united kingdom',
  'great britain': 'united kingdom',
  'czech republic': 'czechia',
  'czechia': 'czech republic',
  'turkey': 'türkiye',
  'türkiye': 'turkey',
  'moldova': 'republic of moldova',
  'republic of moldova': 'moldova',
  'north macedonia': 'macedonia',
  'macedonia': 'north macedonia',
  'bosnia and herzegovina': 'bosnia and herz.',
  'bosnia and herz.': 'bosnia and herzegovina',
  // Africa — world-atlas 110m uses abbreviated names
  'democratic republic of the congo': 'dem. rep. congo',
  'dem. rep. congo': 'democratic republic of the congo',
  'central african republic': 'central african rep.',
  'central african rep.': 'central african republic',
  'equatorial guinea': 'eq. guinea',
  'eq. guinea': 'equatorial guinea',
  'south sudan': 's. sudan',
  's. sudan': 'south sudan',
  'gambia': 'the gambia',
  'the gambia': 'gambia',
  'tanzania': 'united rep. of tanzania',
  'united rep. of tanzania': 'tanzania',
  'ivory coast': "côte d'ivoire",
  "côte d'ivoire": 'ivory coast',
  'cape verde': 'cabo verde',
  'cabo verde': 'cape verde',
  'swaziland': 'eswatini',
  'eswatini': 'swaziland',
  // Asia
  'north korea': 'dem. rep. korea',
  'dem. rep. korea': 'north korea',
  'south korea': 'republic of korea',
  'republic of korea': 'south korea',
  'laos': 'lao pdr',
  'lao pdr': 'laos',
  'timor-leste': 'east timor',
  'east timor': 'timor-leste',
  'myanmar': 'burma',
  'burma': 'myanmar',
  'vietnam': 'viet nam',
  'viet nam': 'vietnam',
  // Oceania
  'micronesia': 'federated states of micronesia',
  'federated states of micronesia': 'micronesia',
}

type GeoFeature = {
  id: string | number
  type: string
  properties: Record<string, unknown>
  geometry: { type: string; coordinates: number[][][][] }
}

function projectXY(lon: number, lat: number): [number, number] {
  return [(lon + 180) * (SVG_W / 360), (90 - lat) * (SVG_H / 180)]
}

function ringToPath(ring: number[][]): string {
  if (ring.length === 0) return ''

  let d = ''
  let prevLon: number | null = null

  for (let i = 0; i < ring.length; i += 1) {
    const coord = ring[i]
    const lon = coord[0]
    const lat = coord[1]
    const [x, y] = projectXY(lon, lat)

    // Break the segment when crossing the antimeridian to avoid long seam lines.
    const crossesDateLine = prevLon !== null && Math.abs(lon - prevLon) > 180
    const cmd = i === 0 || crossesDateLine ? 'M' : 'L'
    d += `${cmd}${x.toFixed(1)},${y.toFixed(1)}`
    prevLon = lon
  }

  return d + 'Z'
}

function geoToPath(geometry: GeoFeature['geometry']): string {
  if (geometry.type === 'Polygon') {
    return (geometry.coordinates as unknown as number[][][]).map((ring) => ringToPath(ring)).join('')
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as number[][][][])
      .flatMap((poly) => poly.map((ring) => ringToPath(ring)))
      .join('')
  }
  return ''
}

function WorldMap({ rows }: { rows: CountryRecord[] }) {
  const [geographies, setGeographies] = useState<GeoFeature[]>([])

  useEffect(() => {
    fetch(WORLD_GEO_URL)
      .then((r) => r.json())
      .then((topology: Topology) => {
        const countries = feature(
          topology,
          (topology.objects as Record<string, Parameters<typeof feature>[1]>)['countries'],
        )
        setGeographies('features' in countries ? (countries.features as GeoFeature[]) : [])
      })
      .catch(() => {})
  }, [])

  const visitedNormalized = useMemo(() => {
    const set = new Set<string>()
    rows
      .filter((r) => r.visited)
      .forEach((r) => set.add(r.country_state_name.toLowerCase().trim()))
    return set
  }, [rows])

  function isVisited(geoName: string): boolean {
    const n = geoName.toLowerCase().trim()
    if (visitedNormalized.has(n)) return true
    const alias = COUNTRY_NAME_ALIASES[n]
    if (alias && visitedNormalized.has(alias)) return true
    // Prefix match: "United States" in sheet matches "United States of America" in atlas
    for (const v of visitedNormalized) {
      if (v.length >= 5 && n.startsWith(v)) return true
    }
    return false
  }

  return (
    <div className="world-map-container">
      {geographies.length === 0 ? (
        <p className="sheets-meta">Loading map...</p>
      ) : (
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          aria-label="World map showing visited countries"
        >
          {geographies.map((geo) => {
            const name = String(geo.properties?.name ?? '')
            const visited = isVisited(name)
            return (
              <path
                key={String(geo.id)}
                d={geoToPath(geo.geometry)}
                className={visited ? 'map-country map-country--visited' : 'map-country'}
                stroke="var(--map-stroke)"
                strokeWidth={0.5}
              />
            )
          })}
        </svg>
      )}
    </div>
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
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [newPlace, setNewPlace] = useState('')
  const [placeFilter, setPlaceFilter] = useState('')
  const [editedPlaces, setEditedPlaces] = useState<Record<string, string>>({})

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

  useEffect(() => {
    const next: Record<string, string> = {}
    rows.forEach((row) => {
      next[row.country_id] = row.country_state_name
    })
    setEditedPlaces(next)
  }, [rows])

  const visited = rows
    .filter((row) => row.visited)
    .sort((a, b) => a.country_state_name.localeCompare(b.country_state_name))
  const filteredRows = rows
    .filter((row) => row.country_state_name.toLowerCase().includes(placeFilter.toLowerCase().trim()))
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

  async function handleCreate() {
    if (!idToken || isWriting) {
      return
    }

    const name = newPlace.trim()
    if (!name) {
      setWriteError('Place name is required.')
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await createCountry(idToken, name, false)
      setNewPlace('')
      await loadCountries()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to create place')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleRename(row: CountryRecord) {
    if (!idToken || isWriting) {
      return
    }

    const name = (editedPlaces[row.country_id] ?? row.country_state_name).trim()
    if (!name) {
      setWriteError('Place name is required.')
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await updateCountry(idToken, row.country_id, name)
      await loadCountries()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to update place')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleDelete(row: CountryRecord) {
    if (!idToken || isWriting) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await deleteCountry(idToken, row.country_id)
      await loadCountries()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to delete place')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <article className="info-card section-page-card sheets-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          {canWrite ? (
            <button
              type="button"
              className={`section-edit-btn ${isEditing ? 'active' : ''}`}
              aria-pressed={isEditing}
              onClick={() => setIsEditing((value) => !value)}
              title="Edit values"
            >
              ✎
            </button>
          ) : null}
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            {isCollapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          {isLoading ? <p className="sheets-meta">Loading places...</p> : null}

          {
            <>
              <WorldMap rows={rows} />
              {!isLoading ? (
                <p className="sheets-meta">
                  {visited.length > 0
                    ? `${visited.length} ${visited.length === 1 ? 'place' : 'places'} visited`
                    : fallbackBody}
                </p>
              ) : null}
            </>
          }

          {canWrite && !idToken ? (
            <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
          ) : null}

          {canWrite && isEditing ? (
            <div className="sheets-editor">
              <p className="sheets-meta">Edit places visited</p>
              <div className="sheets-editor-row">
                <input
                  className="sheets-input"
                  type="text"
                  placeholder="New place"
                  value={newPlace}
                  onChange={(event) => setNewPlace(event.target.value)}
                  disabled={!idToken || isWriting}
                />
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => void handleCreate()}
                  disabled={!idToken || isWriting}
                >
                  Add
                </button>
              </div>

              <input
                className="sheets-input"
                type="text"
                placeholder="Filter by name"
                value={placeFilter}
                onChange={(event) => setPlaceFilter(event.target.value)}
                disabled={!idToken || isWriting}
              />

              <div className="sheets-table-shell">
                <table className="sheets-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Visited</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={`edit-${row.country_id}`}>
                        <td>
                          <input
                            className="sheets-input sheets-table-input"
                            type="text"
                            value={editedPlaces[row.country_id] ?? row.country_state_name}
                            onChange={(event) =>
                              setEditedPlaces((current) => ({
                                ...current,
                                [row.country_id]: event.target.value,
                              }))
                            }
                            disabled={!idToken || isWriting}
                          />
                        </td>
                        <td>{row.visited ? 'Yes' : 'No'}</td>
                        <td>
                          <div className="sheets-table-actions">
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => void handleRename(row)}
                              disabled={!idToken || isWriting}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => void handleToggle(row)}
                              disabled={!idToken || isWriting}
                            >
                              {row.visited ? 'Unvisit' : 'Visit'}
                            </button>
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => void handleDelete(row)}
                              disabled={!idToken || isWriting}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRows.length === 0 ? <p className="sheets-meta">No places match that filter.</p> : null}
            </div>
          ) : null}

          {writeError ? <p className="sheets-error">{writeError}</p> : null}
        </>
      ) : null}
    </article>
  )
}

function BackpackCard({
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
  const [rows, setRows] = useState<BackpackRecord[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [storageFilter, setStorageFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [editedRows, setEditedRows] = useState<Record<number, { storage: string; type: string; quantity: string }>>({})

  async function loadBackpack() {
    try {
      const data = await getBackpackItems()
      setRows(data)
      setWriteError('')
    } catch {
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadBackpack()
  }, [])

  useEffect(() => {
    const next: Record<number, { storage: string; type: string; quantity: string }> = {}
    rows.forEach((row, index) => {
      next[index] = {
        storage: row.storage,
        type: row.type,
        quantity: row.quantity,
      }
    })
    setEditedRows(next)
  }, [rows])

  const storageOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.storage).filter((value) => value))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [rows])

  const typeOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.type).filter((value) => value))).sort((a, b) =>
      a.localeCompare(b),
    )
  }, [rows])

  const filteredRows = useMemo(() => {
    return rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => {
        const storageMatches = storageFilter === 'all' || row.storage === storageFilter
        const typeMatches = typeFilter === 'all' || row.type === typeFilter
        return storageMatches && typeMatches
      })
      .sort((a, b) => {
        const typeCompare = a.row.type.localeCompare(b.row.type)
        if (typeCompare !== 0) {
          return typeCompare
        }

        return a.row.item.localeCompare(b.row.item)
      })
  }, [rows, storageFilter, typeFilter])

  async function handleSave(index: number, row: BackpackRecord) {
    if (!idToken || isWriting || !canWrite) {
      return
    }

    const draft = editedRows[index]
    const nextStorage = (draft?.storage ?? row.storage).trim()
    const nextType = (draft?.type ?? row.type).trim()
    const nextQuantity = (draft?.quantity ?? row.quantity).trim()

    if (!nextStorage || !nextType) {
      setWriteError('Storage and type are required.')
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await updateBackpackItem(idToken, {
        originalStorage: row.storage,
        originalType: row.type,
        originalItem: row.item,
        storage: nextStorage,
        type: nextType,
        quantity: nextQuantity,
      })
      await loadBackpack()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to update backpack item')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <article className="info-card section-page-card sheets-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          {canWrite ? (
            <button
              type="button"
              className={`section-edit-btn ${isEditing ? 'active' : ''}`}
              aria-pressed={isEditing}
              onClick={() => setIsEditing((value) => !value)}
              title="Edit values"
            >
              ✎
            </button>
          ) : null}
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            {isCollapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          {isLoading ? <p className="sheets-meta">Loading backpack...</p> : null}

          {!isLoading ? <p className="sheets-meta">{rows.length > 0 ? `${rows.length} backpack item${rows.length === 1 ? '' : 's'}` : fallbackBody}</p> : null}

          {!canWrite ? (
            <p className="sheets-meta">
              Edit access restricted to Admin profile signed in as {TODOIST_EDITOR_EMAIL}.
            </p>
          ) : null}

          {canWrite && !idToken ? (
            <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
          ) : null}

          <div className="backpack-filter-row">
            <select
              className="sheets-input"
              value={storageFilter}
              onChange={(event) => setStorageFilter(event.target.value)}
              aria-label="Filter by storage"
            >
              <option value="all">All storage</option>
              {storageOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              className="sheets-input"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label="Filter by type"
            >
              <option value="all">All types</option>
              {typeOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="sheets-table-shell">
            <table className="sheets-table">
              <thead>
                <tr>
                  {isEditing && canWrite ? <th>Storage</th> : null}
                  <th>Type</th>
                  <th>Item</th>
                  <th>Quantity</th>
                  {isEditing && canWrite ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map(({ row, index }) => (
                  <tr key={`${row.item}-${index}`}>
                    {isEditing && canWrite ? (
                      <td>
                        <input
                          className="sheets-input sheets-table-input"
                          type="text"
                          value={editedRows[index]?.storage ?? row.storage}
                          onChange={(event) =>
                            setEditedRows((current) => ({
                              ...current,
                              [index]: {
                                storage: event.target.value,
                                type: current[index]?.type ?? row.type,
                                quantity: current[index]?.quantity ?? row.quantity,
                              },
                            }))
                          }
                          disabled={!idToken || isWriting || !canWrite}
                        />
                      </td>
                    ) : null}
                    <td>
                      {isEditing && canWrite ? (
                        <input
                          className="sheets-input sheets-table-input"
                          type="text"
                          value={editedRows[index]?.type ?? row.type}
                          onChange={(event) =>
                            setEditedRows((current) => ({
                              ...current,
                              [index]: {
                                storage: current[index]?.storage ?? row.storage,
                                type: event.target.value,
                                quantity: current[index]?.quantity ?? row.quantity,
                              },
                            }))
                          }
                          disabled={!idToken || isWriting || !canWrite}
                        />
                      ) : (
                        row.type
                      )}
                    </td>
                    <td>{row.item}</td>
                    <td>
                      {isEditing && canWrite ? (
                        <input
                          className="sheets-input sheets-table-input"
                          type="text"
                          value={editedRows[index]?.quantity ?? row.quantity}
                          onChange={(event) =>
                            setEditedRows((current) => ({
                              ...current,
                              [index]: {
                                storage: current[index]?.storage ?? row.storage,
                                type: current[index]?.type ?? row.type,
                                quantity: event.target.value,
                              },
                            }))
                          }
                          disabled={!idToken || isWriting || !canWrite}
                        />
                      ) : (
                        row.quantity
                      )}
                    </td>
                    {isEditing && canWrite ? (
                      <td>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void handleSave(index, row)}
                          disabled={!idToken || isWriting || !canWrite}
                        >
                          Save
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRows.length === 0 ? <p className="sheets-meta">No backpack items match these filters.</p> : null}

          {writeError ? <p className="sheets-error">{writeError}</p> : null}
        </>
      ) : null}
    </article>
  )
}

function normalizeWeekday(value: string) {
  return value.trim().toLowerCase()
}

function getTodayWeekdayName() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long' })
}

function MealPlanCard({
  title,
  fallbackBody,
  canWrite,
  idToken,
  showTodaySummary,
}: {
  title: string
  fallbackBody: string
  canWrite: boolean
  idToken: string
  showTodaySummary: boolean
}) {
  const [rows, setRows] = useState<MealPlanRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [isWeeklyExpanded, setIsWeeklyExpanded] = useState(!showTodaySummary)
  const [isEditing, setIsEditing] = useState(false)
  const [editedRows, setEditedRows] = useState<Record<string, MealPlanRecord>>({})

  async function loadMealPlan() {
    try {
      const data = await getMealPlan()
      setRows(data)
      setWriteError('')
    } catch {
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadMealPlan()
  }, [])

  useEffect(() => {
    const next: Record<string, MealPlanRecord> = {}
    rows.forEach((row) => {
      next[row.day_of_the_week] = { ...row }
    })
    setEditedRows(next)
  }, [rows])

  const sortedRows = useMemo(() => {
    const weekdayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    return [...rows].sort((a, b) => {
      const dayDiff = weekdayOrder.indexOf(normalizeWeekday(a.day_of_the_week)) - weekdayOrder.indexOf(normalizeWeekday(b.day_of_the_week))
      if (dayDiff !== 0) {
        return dayDiff
      }

      return a.day_of_the_week.localeCompare(b.day_of_the_week)
    })
  }, [rows])

  const todayRow = useMemo(() => {
    const today = normalizeWeekday(getTodayWeekdayName())
    return rows.find((row) => {
      const weekday = normalizeWeekday(row.day_of_the_week)
      return weekday === today || weekday.slice(0, 3) === today.slice(0, 3)
    })
  }, [rows])

  async function handleSave(row: MealPlanRecord) {
    if (!idToken || isWriting || !canWrite) {
      return
    }

    const draft = editedRows[row.day_of_the_week] ?? row
    const dayOfTheWeek = draft.day_of_the_week.trim()
    if (!dayOfTheWeek) {
      setWriteError('Day of the week is required.')
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await updateMealPlan(idToken, {
        originalDayOfTheWeek: row.day_of_the_week,
        dayOfTheWeek,
        breakfast: draft.breakfast.trim(),
        lunch: draft.lunch.trim(),
        dinner: draft.dinner.trim(),
        snack: draft.snack.trim(),
      })
      await loadMealPlan()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to update meal plan')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <article className="info-card section-page-card sheets-card meal-plan-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          {!showTodaySummary && canWrite ? (
            <button
              type="button"
              className={`section-edit-btn ${isEditing ? 'active' : ''}`}
              aria-pressed={isEditing}
              onClick={() => setIsEditing((value) => !value)}
              title="Edit values"
            >
              ✎
            </button>
          ) : null}
          {!showTodaySummary ? (
            <button
              type="button"
              className="section-collapse-btn"
              aria-expanded={isWeeklyExpanded}
              onClick={() => setIsWeeklyExpanded((value) => !value)}
            >
              {isWeeklyExpanded ? 'Hide' : 'Show'}
            </button>
          ) : null}
        </div>
      </div>

      {isLoading ? <p className="sheets-meta">Loading meal plan...</p> : null}

      {showTodaySummary && !isLoading ? (
        todayRow ? (
          <div className="meal-plan-day-grid">
            <div className="meal-plan-day-item">
              <p className="meal-plan-label">Breakfast</p>
              <p>{todayRow.breakfast || 'Not planned'}</p>
            </div>
            <div className="meal-plan-day-item">
              <p className="meal-plan-label">Lunch</p>
              <p>{todayRow.lunch || 'Not planned'}</p>
            </div>
            <div className="meal-plan-day-item">
              <p className="meal-plan-label">Dinner</p>
              <p>{todayRow.dinner || 'Not planned'}</p>
            </div>
            <div className="meal-plan-day-item">
              <p className="meal-plan-label">Snack</p>
              <p>{todayRow.snack || 'Not planned'}</p>
            </div>
          </div>
        ) : (
          <p className="sheets-meta">{fallbackBody || 'No meal plan found for today.'}</p>
        )
      ) : null}

      {!canWrite ? (
        <p className="sheets-meta">
          Edit access restricted to Admin profile signed in as {TODOIST_EDITOR_EMAIL}.
        </p>
      ) : null}

      {canWrite && !idToken ? (
        <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
      ) : null}

      {isWeeklyExpanded ? (
        <div className="meal-plan-weekly-section">
          <div className="sheets-table-shell meal-plan-table-shell">
            <table className="sheets-table meal-plan-table">
              <thead>
                <tr>
                  <th>Day of week</th>
                  <th>Breakfast</th>
                  <th>Lunch</th>
                  <th>Dinner</th>
                  <th>Snack</th>
                  {isEditing && canWrite ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.day_of_the_week}>
                    <td data-label="Day of week">
                      {isEditing && canWrite ? (
                        <input
                          className="sheets-input sheets-table-input"
                          type="text"
                          value={editedRows[row.day_of_the_week]?.day_of_the_week ?? row.day_of_the_week}
                          onChange={(event) =>
                            setEditedRows((current) => ({
                              ...current,
                              [row.day_of_the_week]: {
                                ...(current[row.day_of_the_week] ?? row),
                                day_of_the_week: event.target.value,
                              },
                            }))
                          }
                          disabled={!idToken || isWriting || !canWrite}
                        />
                      ) : (
                        row.day_of_the_week
                      )}
                    </td>
                    <td data-label="Breakfast">
                      {isEditing && canWrite ? (
                        <input
                          className="sheets-input sheets-table-input"
                          type="text"
                          value={editedRows[row.day_of_the_week]?.breakfast ?? row.breakfast}
                          onChange={(event) =>
                            setEditedRows((current) => ({
                              ...current,
                              [row.day_of_the_week]: {
                                ...(current[row.day_of_the_week] ?? row),
                                breakfast: event.target.value,
                              },
                            }))
                          }
                          disabled={!idToken || isWriting || !canWrite}
                        />
                      ) : (
                        row.breakfast
                      )}
                    </td>
                    <td data-label="Lunch">
                      {isEditing && canWrite ? (
                        <input
                          className="sheets-input sheets-table-input"
                          type="text"
                          value={editedRows[row.day_of_the_week]?.lunch ?? row.lunch}
                          onChange={(event) =>
                            setEditedRows((current) => ({
                              ...current,
                              [row.day_of_the_week]: {
                                ...(current[row.day_of_the_week] ?? row),
                                lunch: event.target.value,
                              },
                            }))
                          }
                          disabled={!idToken || isWriting || !canWrite}
                        />
                      ) : (
                        row.lunch
                      )}
                    </td>
                    <td data-label="Dinner">
                      {isEditing && canWrite ? (
                        <input
                          className="sheets-input sheets-table-input"
                          type="text"
                          value={editedRows[row.day_of_the_week]?.dinner ?? row.dinner}
                          onChange={(event) =>
                            setEditedRows((current) => ({
                              ...current,
                              [row.day_of_the_week]: {
                                ...(current[row.day_of_the_week] ?? row),
                                dinner: event.target.value,
                              },
                            }))
                          }
                          disabled={!idToken || isWriting || !canWrite}
                        />
                      ) : (
                        row.dinner
                      )}
                    </td>
                    <td data-label="Snack">
                      {isEditing && canWrite ? (
                        <input
                          className="sheets-input sheets-table-input"
                          type="text"
                          value={editedRows[row.day_of_the_week]?.snack ?? row.snack}
                          onChange={(event) =>
                            setEditedRows((current) => ({
                              ...current,
                              [row.day_of_the_week]: {
                                ...(current[row.day_of_the_week] ?? row),
                                snack: event.target.value,
                              },
                            }))
                          }
                          disabled={!idToken || isWriting || !canWrite}
                        />
                      ) : (
                        row.snack
                      )}
                    </td>
                    {isEditing && canWrite ? (
                      <td data-label="Actions">
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void handleSave(row)}
                          disabled={!idToken || isWriting || !canWrite}
                        >
                          Save
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sortedRows.length === 0 ? <p className="sheets-meta">No meal plan rows found.</p> : null}
        </div>
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

function parseTrainingDate(value?: string) {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function getQuarterForDate(date: Date) {
  return `Q${Math.floor(date.getMonth() / 3) + 1}` as 'Q1' | 'Q2' | 'Q3' | 'Q4'
}

function isRestDayWorkout(value?: string) {
  if (!value) {
    return false
  }

  return value.trim().toLowerCase() === 'rest day'
}

function getTrainingTileLevel(row: TrainingRecord) {
  const completedCount = Number(row.completed_morning) + Number(row.completed_evening)
  const isRestDay = isRestDayWorkout(row.morning_workout) || isRestDayWorkout(row.evening_workout)

  if (completedCount >= 2) {
    return 2
  }

  if (completedCount === 1 || isRestDay) {
    return 1
  }

  return 0
}

function TrainingLogCard({
  title,
  canWrite,
  idToken,
}: {
  title: string
  canWrite: boolean
  idToken: string
}) {
  const currentDate = new Date()
  const currentYear = String(currentDate.getFullYear())
  const currentSeason = getQuarterForDate(currentDate)

  const [rows, setRows] = useState<TrainingRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [seasonFilter, setSeasonFilter] = useState<'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4'>(currentSeason)
  const [yearFilter, setYearFilter] = useState(currentYear)

  useEffect(() => {
    let isMounted = true

    async function loadTrainingLog() {
      try {
        const data = await getTrainingRecords()
        if (isMounted) {
          setRows(data)
        }
      } catch {
        if (isMounted) {
          setRows([])
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadTrainingLog()

    return () => {
      isMounted = false
    }
  }, [])

  const availableYears = useMemo(() => {
    const years = rows
      .map((row) => parseTrainingDate(row.date)?.getFullYear())
      .filter((year): year is number => typeof year === 'number')

    return Array.from(new Set(years)).sort((a, b) => b - a)
  }, [rows])

  const selectableYears = useMemo(() => {
    const years = new Set(availableYears)
    years.add(Number(currentYear))
    return Array.from(years).sort((a, b) => b - a)
  }, [availableYears, currentYear])

  useEffect(() => {
    if (selectableYears.length === 0) {
      setYearFilter(currentYear)
      return
    }

    const hasCurrentSelection = selectableYears.some((year) => String(year) === yearFilter)
    if (!hasCurrentSelection) {
      setYearFilter(currentYear)
    }
  }, [currentYear, selectableYears, yearFilter])

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => {
        const parsedDate = parseTrainingDate(row.date)
        if (!parsedDate) {
          return false
        }

        if (!yearFilter || String(parsedDate.getFullYear()) !== yearFilter) {
          return false
        }

        if (seasonFilter !== 'all' && getQuarterForDate(parsedDate) !== seasonFilter) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        const aDate = parseTrainingDate(a.date)?.getTime() ?? 0
        const bDate = parseTrainingDate(b.date)?.getTime() ?? 0
        return aDate - bDate
      })
  }, [rows, seasonFilter, yearFilter])

  const monthGroups = useMemo(() => {
    const groups = new Map<number, TrainingRecord[]>()

    for (const row of filteredRows) {
      const parsedDate = parseTrainingDate(row.date)
      if (!parsedDate) {
        continue
      }

      const monthIndex = parsedDate.getMonth()
      const current = groups.get(monthIndex) ?? []
      current.push(row)
      groups.set(monthIndex, current)
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([monthIndex, monthRows]) => ({
        monthIndex,
        label: new Date(2026, monthIndex, 1).toLocaleDateString(undefined, { month: 'short' }),
        rows: monthRows,
      }))
  }, [filteredRows])

  const todayDate = new Date()
  const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`
  const todaysRecord = useMemo(
    () => rows.find((row) => toDateOnlyKey(row.date) === todayKey),
    [rows, todayKey],
  )

  async function handleToggleWorkout(period: 'morning' | 'evening') {
    if (!canWrite || !idToken || !todaysRecord || isWriting) {
      return
    }

    const isMorning = period === 'morning'
    const nextCompleted = isMorning ? !todaysRecord.completed_morning : !todaysRecord.completed_evening
    const previousRows = rows

    setWriteError('')
    setIsWriting(true)
    setRows((currentRows) =>
      currentRows.map((row) => {
        if (row.training_id !== todaysRecord.training_id) {
          return row
        }

        if (isMorning) {
          return { ...row, completed_morning: nextCompleted }
        }

        return { ...row, completed_evening: nextCompleted }
      }),
    )

    try {
      await setTrainingWorkoutCompleted(idToken, todaysRecord.training_id, period, nextCompleted)
    } catch (error) {
      setRows(previousRows)
      setWriteError(error instanceof Error ? error.message : 'Unable to update workout completion state')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <CollapsibleSectionCard title={title} className="training-log-card">
      {isLoading ? <p className="sheets-meta">Loading training log...</p> : null}

      {!isLoading ? (
        <>
          <div className="training-log-today-panel">
            <p className="sheets-meta">Workout(s) of the Day</p>
            {todaysRecord ? (
              <div className="study-today-shell">
                <table className="study-today-table">
                  <thead>
                    <tr>
                      <th>Workout</th>
                      <th>Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{todaysRecord.morning_workout || 'Morning —'}</td>
                      <td className="study-complete-cell">
                        {canWrite ? (
                          <button
                            type="button"
                            className="secondary-action study-complete-btn"
                            onClick={() => void handleToggleWorkout('morning')}
                            disabled={!idToken || isWriting}
                          >
                            {todaysRecord.completed_morning ? '✓ Completed' : 'Mark Complete'}
                          </button>
                        ) : (
                          <span>{todaysRecord.completed_morning ? '✓ Yes' : 'No'}</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>{todaysRecord.evening_workout || 'Evening —'}</td>
                      <td className="study-complete-cell">
                        {canWrite ? (
                          <button
                            type="button"
                            className="secondary-action study-complete-btn"
                            onClick={() => void handleToggleWorkout('evening')}
                            disabled={!idToken || isWriting}
                          >
                            {todaysRecord.completed_evening ? '✓ Completed' : 'Mark Complete'}
                          </button>
                        ) : (
                          <span>{todaysRecord.completed_evening ? '✓ Yes' : 'No'}</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="sheets-meta">No workout scheduled for today.</p>
            )}

            {!canWrite ? (
              <p className="sheets-meta">
                Edit access restricted to Admin profile signed in as {TODOIST_EDITOR_EMAIL}.
              </p>
            ) : null}

            {writeError ? <p className="sheets-error">{writeError}</p> : null}
          </div>

          <div className="training-log-filters">
            <label>
              <span className="sheets-meta">Season</span>
              <select
                className="sheets-input"
                value={seasonFilter}
                onChange={(event) => setSeasonFilter(event.target.value as 'all' | 'Q1' | 'Q2' | 'Q3' | 'Q4')}
              >
                <option value="all">All seasons</option>
                <option value="Q1">Q1 (Jan-Mar)</option>
                <option value="Q2">Q2 (Apr-Jun)</option>
                <option value="Q3">Q3 (Jul-Sep)</option>
                <option value="Q4">Q4 (Oct-Dec)</option>
              </select>
            </label>

            <label>
              <span className="sheets-meta">Year</span>
              <select className="sheets-input" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                {selectableYears.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {filteredRows.length > 0 ? (
            <>
              <div className="training-log-grid" aria-label="Training activity tiles by month">
                <div className="training-log-grid-panel">
                  {monthGroups.map((group) => (
                    <div key={group.monthIndex} className="training-log-row">
                      <div className="training-log-month-label" aria-label={`Month ${group.label}`}>{group.label}</div>
                      <div
                        className="training-log-row-tiles"
                        role="list"
                        aria-label={`${group.label} training activity`}
                      >
                        {group.rows.map((row) => {
                          const tileLevel = getTrainingTileLevel(row)
                          const label = `${formatSheetDate(row.date)} activity level ${tileLevel}`

                          return (
                            <div
                              key={row.training_id}
                              role="listitem"
                              className={`training-log-tile level-${tileLevel}`}
                              aria-label={label}
                              title={label}
                              data-training-id={row.training_id}
                              data-level={String(tileLevel)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <p className="sheets-meta">Light: one workout completed or rest day. Dark: both workouts completed.</p>
            </>
          ) : (
            <p className="sheets-meta">No training records match this season/year filter.</p>
          )}
        </>
      ) : null}
    </CollapsibleSectionCard>
  )
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

function toLocalDateTimeInputFromValue(value?: string) {
  if (!value) {
    return ''
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return toLocalDateTimeInputValue(parsed)
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    return undefined
  }

  return parsed
}

type EventDraft = {
  eventDate: string
  eventName: string
  type: string
  measurement: string
  location: string
  link: string
  price: string
  active: boolean
}

function toEventDraft(row: EventRecord): EventDraft {
  return {
    eventDate: toLocalDateTimeInputFromValue(row.event_date),
    eventName: row.event_name,
    type: row.type ?? '',
    measurement: row.measurement ?? '',
    location: row.location ?? '',
    link: row.link ?? '',
    price: typeof row.price === 'number' ? String(row.price) : '',
    active: row.active,
  }
}

function NextEventCountdownCard({
  title,
  canWrite,
  idToken,
}: {
  title: string
  canWrite: boolean
  idToken: string
}) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [rows, setRows] = useState<EventRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [editingEventId, setEditingEventId] = useState('')
  const [newEvent, setNewEvent] = useState<EventDraft>({
    eventDate: '',
    eventName: '',
    type: '',
    measurement: '',
    location: '',
    link: '',
    price: '',
    active: false,
  })
  const [nowMs, setNowMs] = useState(Date.now())

  async function loadEvents() {
    try {
      const data = await getEvents()
      setRows(data)
    } catch {
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadEvents()
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const activeEvent = useMemo(() => rows.find((row) => row.active), [rows])

  async function handleDeleteEvent(eventId: string) {
    if (!canWrite || !idToken || isWriting) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await deleteEvent(idToken, eventId)
      await loadEvents()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to delete event')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleSetActiveEvent(eventId: string) {
    if (!canWrite || !idToken || isWriting) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await setActiveEvent(idToken, eventId)
      await loadEvents()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to set active event')
    } finally {
      setIsWriting(false)
    }
  }

  const parts = getCountdownParts(activeEvent?.event_date ?? '', nowMs)
  const isFinished = parts.totalMs <= 0
  const targetLabel = activeEvent?.event_date ? new Date(activeEvent.event_date).toLocaleString() : 'Set a date'

  function resetEventForm() {
    setEditingEventId('')
    setNewEvent({
      eventDate: '',
      eventName: '',
      type: '',
      measurement: '',
      location: '',
      link: '',
      price: '',
      active: false,
    })
  }

  function startEditingEvent(row: EventRecord) {
    setEditingEventId(row.event_id)
    setNewEvent(toEventDraft(row))
    setWriteError('')
  }

  async function handleSubmitEvent() {
    if (!canWrite || !idToken || isWriting) {
      return
    }

    const eventName = newEvent.eventName.trim()
    const eventDate = newEvent.eventDate.trim()
    if (!eventName || !eventDate) {
      setWriteError('Event title and event date are required.')
      return
    }

    setIsWriting(true)
    setWriteError('')

    try {
      if (editingEventId) {
        const editingRow = rows.find((row) => row.event_id === editingEventId)
        await updateEvent(idToken, editingEventId, {
          eventDate,
          eventName,
          type: newEvent.type.trim(),
          measurement: newEvent.measurement.trim(),
          location: newEvent.location.trim(),
          link: newEvent.link.trim(),
          price: parseOptionalNumber(newEvent.price),
          active: editingRow?.active ?? false,
        })
      } else {
        await createEvent(idToken, {
          eventDate,
          eventName,
          type: newEvent.type.trim(),
          measurement: newEvent.measurement.trim(),
          location: newEvent.location.trim(),
          link: newEvent.link.trim(),
          price: parseOptionalNumber(newEvent.price),
          active: false,
        })
      }

      resetEventForm()
      await loadEvents()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : editingEventId ? 'Unable to update event' : 'Unable to create event')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <article className="info-card section-page-card countdown-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          {canWrite ? (
            <button
              type="button"
              className={`section-edit-btn ${isEditing ? 'active' : ''}`}
              title="Edit values"
              aria-label="Edit values"
              aria-pressed={isEditing}
              onClick={() => setIsEditing((value) => !value)}
            >
              ✎
            </button>
          ) : null}
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            {isCollapsed ? 'Show' : 'Hide'}
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          {isLoading ? <p className="sheets-meta">Loading events...</p> : null}

          {!isLoading ? <p className="countdown-title">{activeEvent?.event_name || 'No active event'}</p> : null}
          <p className="countdown-target">Target: {targetLabel}</p>
          {activeEvent?.location ? <p className="countdown-location">Location: {activeEvent.location}</p> : null}

          {!isLoading && !activeEvent ? (
            <p className="countdown-lock-note">No active event found. Set one active event to start countdown.</p>
          ) : null}

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

          {canWrite && !idToken ? (
            <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
          ) : null}

          {canWrite && isEditing ? (
            <div className="countdown-editor">
              <p className="sheets-meta">{editingEventId ? 'Update Event' : 'Add Event'}</p>
              <div className="countdown-inputs">
                <label>
                  <span>Event title</span>
                  <input
                    type="text"
                    value={newEvent.eventName}
                    onChange={(event) =>
                      setNewEvent((current) => ({
                        ...current,
                        eventName: event.target.value,
                      }))
                    }
                    placeholder="Race day, meet, hike, etc."
                    disabled={!idToken || isWriting}
                  />
                </label>

                <label>
                  <span>Event date</span>
                  <input
                    type="datetime-local"
                    value={newEvent.eventDate}
                    onChange={(event) =>
                      setNewEvent((current) => ({
                        ...current,
                        eventDate: event.target.value,
                      }))
                    }
                    disabled={!idToken || isWriting}
                  />
                </label>

                <label>
                  <span>Type</span>
                  <input
                    type="text"
                    value={newEvent.type}
                    onChange={(event) =>
                      setNewEvent((current) => ({
                        ...current,
                        type: event.target.value,
                      }))
                    }
                    disabled={!idToken || isWriting}
                  />
                </label>

                <label>
                  <span>Measurement</span>
                  <input
                    type="text"
                    value={newEvent.measurement}
                    onChange={(event) =>
                      setNewEvent((current) => ({
                        ...current,
                        measurement: event.target.value,
                      }))
                    }
                    disabled={!idToken || isWriting}
                  />
                </label>

                <label>
                  <span>Location</span>
                  <input
                    type="text"
                    value={newEvent.location}
                    onChange={(event) =>
                      setNewEvent((current) => ({
                        ...current,
                        location: event.target.value,
                      }))
                    }
                    disabled={!idToken || isWriting}
                  />
                </label>

                <label>
                  <span>Link</span>
                  <input
                    type="text"
                    value={newEvent.link}
                    onChange={(event) =>
                      setNewEvent((current) => ({
                        ...current,
                        link: event.target.value,
                      }))
                    }
                    disabled={!idToken || isWriting}
                  />
                </label>

                <label>
                  <span>Price</span>
                  <input
                    type="text"
                    value={newEvent.price}
                    onChange={(event) =>
                      setNewEvent((current) => ({
                        ...current,
                        price: event.target.value,
                      }))
                    }
                    disabled={!idToken || isWriting}
                  />
                </label>
              </div>

              <div className="sheets-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => void handleSubmitEvent()}
                  disabled={!idToken || isWriting}
                >
                  {editingEventId ? 'Update Event' : 'Add Event'}
                </button>
                {editingEventId ? (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={resetEventForm}
                    disabled={!idToken || isWriting}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>

              {rows.length > 0 ? (
                <ul className="countdown-event-list">
                  {rows.map((row) => (
                    <li key={row.event_id} className="countdown-event-item">
                      <span className="countdown-event-name">
                        {row.event_name}
                        {row.active ? ' (Active)' : ''}
                      </span>
                      <div className="countdown-event-actions">
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => startEditingEvent(row)}
                          disabled={!idToken || isWriting}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void handleSetActiveEvent(row.event_id)}
                          disabled={!idToken || isWriting || row.active}
                        >
                          {row.active ? 'Active' : 'Set Active'}
                        </button>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void handleDeleteEvent(row.event_id)}
                          disabled={!idToken || isWriting}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sheets-meta">No events found.</p>
              )}
            </div>
          ) : null}

          {writeError ? <p className="sheets-error">{writeError}</p> : null}
        </>
      ) : null}
    </article>
  )
}

function ActuaryExamsCard({ title }: { title: string }) {
  return (
    <CollapsibleSectionCard title={title} className="experience-card">
      <ul className="experience-list">
        {actuaryExamEntries.map((entry) => (
          <ActuaryExamRow
            key={`${entry.exam}-${entry.topic}`}
            entry={entry}
          />
        ))}
      </ul>
    </CollapsibleSectionCard>
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
    <CollapsibleSectionCard title={title} className="experience-card">
      <ul className="experience-list">
        {educationEntries.map((entry) => (
          <EducationRow
            key={`${entry.degree}-${entry.institution}`}
            entry={entry}
          />
        ))}
      </ul>
    </CollapsibleSectionCard>
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
    <CollapsibleSectionCard title={title} className="experience-card">
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
    </CollapsibleSectionCard>
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

function toDateOnlyKey(value?: string) {
  if (!value) {
    return ''
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

function CurrentStudyPlanCard({
  title,
  body,
  canWrite,
  idToken,
}: {
  title: string
  body: string
  canWrite: boolean
  idToken: string
}) {
  const [rows, setRows] = useState<CurrentStudyRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const [relatedExamFilter, setRelatedExamFilter] = useState('all')
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')

  async function loadCurrentStudy() {
    try {
      const data = await getCurrentStudy()
      setRows(data)
    } catch {
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadCurrentStudy()
  }, [])

  async function handleToggleCompleted(row: CurrentStudyRecord) {
    if (!canWrite || !idToken || isWriting) {
      return
    }

    const previousRows = rows
    const nextCompleted = !row.completed
    setIsWriting(true)
    setWriteError('')
    setRows((currentRows) =>
      currentRows.map((currentRow) =>
        currentRow.study_id === row.study_id ? { ...currentRow, completed: nextCompleted } : currentRow,
      ),
    )

    try {
      await setCurrentStudyCompleted(idToken, row.study_id, nextCompleted)
      void loadCurrentStudy()
    } catch (error) {
      setRows(previousRows)
      setWriteError(error instanceof Error ? error.message : 'Unable to update completion state')
    } finally {
      setIsWriting(false)
    }
  }

  // Exclude topics: 'Rest Day' and 'Take Sample Exam #(any number)'
  function isExcludedTopic(topic: string) {
    if (!topic) return false
    const trimmed = topic.trim()
    if (trimmed.toLowerCase() === 'rest day') return true
    if (/^take sample exam #\d+$/i.test(trimmed)) return true
    if (/^attempt \d+ problems$/i.test(trimmed)) return true
    return false
  }

  const filteredRowsAll = rows.filter((row) => !isExcludedTopic(row.topic))

  const todayKey = toDateOnlyKey(new Date().toISOString())
  const todaysLessons = filteredRowsAll
    .filter((row) => toDateOnlyKey(row.date) === todayKey)
    .sort((a, b) => a.topic.localeCompare(b.topic))

  const relatedExams = Array.from(
    new Set(filteredRowsAll.map((row) => row.related_exam).filter((value) => value.trim().length > 0)),
  ).sort((a, b) => a.localeCompare(b))

  const filteredRows = filteredRowsAll
    .filter((row) => relatedExamFilter === 'all' || row.related_exam === relatedExamFilter)
    .sort((a, b) => a.topic.localeCompare(b.topic))

  return (
    <article className="info-card section-page-card sheets-card">
      <h3>{title}</h3>

      {isLoading ? <p className="sheets-meta">Loading current study...</p> : null}

      {!isLoading ? (
        <>
          <p className="sheets-meta">Today's Lesson</p>
          {todaysLessons.length > 0 ? (
            <div className="study-today-shell">
              <table className="study-today-table">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {todaysLessons.map((row) => (
                    <tr key={row.study_id}>
                      <td>{row.topic}</td>
                      <td className="study-complete-cell" aria-label={row.completed ? 'Completed' : 'Not completed'}>
                        {canWrite ? (
                          <button
                            type="button"
                            className="secondary-action study-complete-btn"
                            onClick={() => void handleToggleCompleted(row)}
                            disabled={!idToken || isWriting}
                          >
                            {row.completed ? '✓ Completed' : 'Mark Complete'}
                          </button>
                        ) : row.completed ? (
                          '✓'
                        ) : (
                          ''
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="sheets-meta">No lesson scheduled for today.</p>
          )}

          {canWrite && !idToken ? (
            <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
          ) : null}

          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? 'Hide Study Table' : 'Show Study Table'}
          </button>

          {expanded ? (
            <div className="study-table-panel">
              <label className="study-filter-row">
                <span className="sheets-meta">Filter by related exam</span>
                <select
                  className="sheets-input"
                  value={relatedExamFilter}
                  onChange={(event) => setRelatedExamFilter(event.target.value)}
                >
                  <option value="all">All exams</option>
                  {relatedExams.map((exam) => (
                    <option key={exam} value={exam}>
                      {exam}
                    </option>
                  ))}
                </select>
              </label>

              <div className="sheets-table-shell">
                <table className="sheets-table">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Problems Solved</th>
                      <th>Problems Worked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => (
                      <tr key={`study-${row.study_id}`}>
                        <td>{row.topic}</td>
                        <td>{row.problems_solved ?? 0}</td>
                        <td>{row.problems_worked ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRows.length === 0 ? <p className="sheets-meta">No rows for this exam filter.</p> : null}
            </div>
          ) : null}
        </>
      ) : null}

      {!isLoading && rows.length === 0 ? <p>{body}</p> : null}
      {writeError ? <p className="sheets-error">{writeError}</p> : null}
    </article>
  )
}

function DetailPage({
  path,
  profile = 'guest',
  googleIdToken = '',
}: {
  path: string
  profile?: UserProfile
  googleIdToken?: string
}) {
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
        if (path === '/experiences/studying' && card.title === 'Current Study Plan') {
          return (
            <CurrentStudyPlanCard
              key={card.title}
              title={card.title}
              body={card.body}
              canWrite={profile === 'admin'}
              idToken={googleIdToken}
            />
          )
        }

        if (path === '/experiences/studying' && card.title === 'Pomodoro Timer') {
          return <PomodoroTimerCard key={card.title} title={card.title} body={card.body} />
        }

        if (path === '/training/records' && card.title === 'Milestones') {
          return <MilestonesCard key={card.title} title={card.title} canEdit={false} />
        }

        if (path === '/cooking/plan' && card.title === 'Meal Plan for the Week') {
          const googleEmail = getGoogleTokenEmail(googleIdToken)
          const canWrite = profile === 'admin' && googleEmail === TODOIST_EDITOR_EMAIL

          return (
            <MealPlanCard
              key={card.title}
              title={card.title}
              fallbackBody={card.body}
              canWrite={canWrite}
              idToken={googleIdToken}
              showTodaySummary={false}
            />
          )
        }

        // Add Google Drive Study Notes link with icon for Study Materials card
        if (path === '/experiences/studying' && card.title === 'Study Materials') {
          return (
            <article key={card.title} className="info-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
              <a
                href="https://drive.google.com/drive/folders/1mbcZlFIksypI088sjbO5q14xp6s0M6Fz?usp=drive_link"
                target="_blank"
                rel="noopener noreferrer"
                className="study-drive-link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.6rem', fontWeight: 500 }}
              >
                <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
                  {/* Google Drive SVG icon */}
                  <svg width="22" height="22" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="25,8 39,32 33,32 19,8" fill="#2196F3"/>
                    <polygon points="19,8 5,32 11,32 25,8" fill="#4CAF50"/>
                    <polygon points="5,32 11,32 17,42 11,42" fill="#FFC107"/>
                    <polygon points="39,32 33,32 27,42 33,42" fill="#FFC107"/>
                    <polygon points="17,42 27,42 33,32 11,32" fill="#F44336"/>
                  </svg>
                </span>
                <span>Study Notes (Google Drive)</span>
              </a>
            </article>
          )
        }
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
                  navigate('/')
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
                className="secondary-action"
                onClick={() => {
                  onSwitchProfile('admin')
                  navigate('/')
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
