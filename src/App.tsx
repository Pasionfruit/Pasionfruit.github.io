import React, { type CSSProperties, type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { GoogleLogin, useGoogleOneTapLogin, type CredentialResponse } from '@react-oauth/google'
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
  navSections,
  professionalExperienceEntries,
  sectionPages,
  type ActuaryExamEntry,
  type EducationEntry,
  type ProfessionalExperienceEntry,
  type SectionId,
} from './siteContent'
import {
  createBucketItem,
  getAbeTransactions,
  createGroceryListItem,
  getCiaraTransactions,
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
  getGroceryList,
  getMealPlan,
  getPolls,
  getPersonalTraining,
  getGarminHealth,
  getRingconnHealth,
  getAppleHealth,
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
  updateGroceryListItem,
  updateMealPlan,
  votePoll,
  getBudgetTargets,
  saveBudgetTarget,
  type BudgetTargetRecord,
} from './data/sheets/repositories'
import type {
  AppleHealthRecord,
  BackpackRecord,
  BucketListRecord,
  CountryRecord,
  CurrentStudyRecord,
  EventRecord,
  FinanceTransactionRecord,
  GarminHealthRecord,
  GroceryListRecord,
  MealPlanRecord,
  PersonalTrainingRecord,
  PollRecord,
  RingconnHealthRecord,
  TrainingRecord,
} from './data/sheets/types'
import { warmupAppsScript } from './data/sheets/client'
import { closeTask, createTask, getTasksOfTheDay, updateTask } from './data/todoist/repositories'
import type { TodoistTask } from './data/todoist/types'

type ThemeMode = 'light' | 'dark'
type UserProfile = 'guest' | 'admin'
const TODOIST_EDITOR_EMAIL = 'pasionabe@gmail.com'
const ADMIN_GOOGLE_EMAILS = ['pasionabe@gmail.com', 'pixielee1000@gmail.com']
const FINANCES_ACCESS_EMAILS = ADMIN_GOOGLE_EMAILS

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

function canViewFinances(googleEmail: string) {
  return FINANCES_ACCESS_EMAILS.includes(googleEmail)
}

function shouldUseAdminProfile(googleEmail: string) {
  return ADMIN_GOOGLE_EMAILS.includes(googleEmail)
}


function App() {
  const [profile, setProfile] = useState<UserProfile>(() => getInitialProfile())
  const [googleIdToken, setGoogleIdToken] = useState(() => getInitialGoogleToken())
  const previousGoogleTokenRef = useRef<string | null>(null)
  const googleEmail = getGoogleTokenEmail(googleIdToken)
  const canViewPrivateFinances = canViewFinances(googleEmail)

  useEffect(() => {
    warmupAppsScript()
  }, [])

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

  useEffect(() => {
    const hadPreviousGoogleToken = Boolean(previousGoogleTokenRef.current)

    if (googleIdToken && googleEmail) {
      const nextProfile = shouldUseAdminProfile(googleEmail) ? 'admin' : 'guest'

      if (profile !== nextProfile) {
        setProfile(nextProfile)
      }
    } else if (hadPreviousGoogleToken && profile !== 'guest') {
      setProfile('guest')
    }

    previousGoogleTokenRef.current = googleIdToken || null
  }, [googleEmail, googleIdToken, profile])

  function handleAutoSignInToken(token: string) {
    const email = getGoogleTokenEmail(token)
    setProfile(shouldUseAdminProfile(email) ? 'admin' : 'guest')
    setGoogleIdToken(token)
  }

  return (
    <>
      {googleClientConfigured && !googleIdToken && (
        <GoogleAutoSignIn onToken={handleAutoSignInToken} />
      )}
      <Routes>
      <Route element={<SiteLayout canViewFinances={canViewPrivateFinances} />}>
        <Route
          index
          element={(
            <HomePage
              profile={profile}
              googleIdToken={googleIdToken}
              canViewFinances={canViewPrivateFinances}
            />
          )}
        />
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
        <Route path="mrpasionfruit/finances" element={<Navigate replace to="/finances" />} />
        <Route
          path="finances"
          element={(
            <SectionPage
              sectionId="finances"
              profile={profile}
              googleIdToken={googleIdToken}
              canViewFinances={canViewPrivateFinances}
            />
          )}
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
    </>
  )
}

function SiteLayout({ canViewFinances }: { canViewFinances: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme())
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const [financeAccessDeniedOpen, setFinanceAccessDeniedOpen] = useState(false)
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

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  function toggleSection(sectionId: SectionId) {
    setExpandedSectionIds((previous) =>
      previous.includes(sectionId)
        ? previous.filter((id) => id !== sectionId)
        : [...previous, sectionId],
    )
  }

  function handleFinanceLinkClick(event: MouseEvent<HTMLAnchorElement>) {
    if (canViewFinances) {
      return
    }

    event.preventDefault()
    setFinanceAccessDeniedOpen(true)
    setMenuOpen(false)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Go to home page">
          <span className="brand-mark">PF</span>
          <span className="brand-copy">
            <strong>Pasionfruit</strong>
            <small>Another Vibe Coded Site</small>
          </span>
        </Link>

        <div className="topbar-actions">
          <button
            type="button"
            className="theme-toggle"
            aria-label={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'}
            aria-pressed={theme === 'dark'}
            title={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'}
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
          >
            {theme === 'light' ? <MoonIcon active /> : <SunIcon active />}
          </button>
          <NavLink to="/login" className="login-link" aria-label="Login">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
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

      {!isOnline ? (
        <p className="connectivity-banner" role="status" aria-live="polite">
          You are offline. Cached pages may still work, but live updates and saves are unavailable.
        </p>
      ) : null}

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
            const visibleChildren =
              section.id === 'finances' && !canViewFinances ? [] : section.children
            const hasChildren = visibleChildren.length > 0
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
                    onClick={
                      section.id === 'finances'
                        ? handleFinanceLinkClick
                        : undefined
                    }
                  >
                    {section.title}
                  </NavLink>
                </div>

                <p className="menu-section-summary">{section.summary}</p>

                {hasChildren && isExpanded ? (
                  <div className="menu-children">
                    {visibleChildren.map((child) => (
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

      {financeAccessDeniedOpen ? (
        <div className="finance-access-dialog-backdrop" role="presentation" onClick={() => setFinanceAccessDeniedOpen(false)}>
          <div
            className="finance-access-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="finance-access-dialog-title"
            aria-describedby="finance-access-dialog-body"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="finance-access-dialog-title">Access denied</h2>
            <p id="finance-access-dialog-body">
              You don&apos;t have access to Finances.
            </p>
            <button type="button" className="finance-dialog-close" onClick={() => setFinanceAccessDeniedOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
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

function HomePage({
  profile,
  googleIdToken,
  canViewFinances,
}: {
  profile: UserProfile
  googleIdToken: string
  canViewFinances: boolean
}) {
  const [financeAccessDeniedOpen, setFinanceAccessDeniedOpen] = useState(false)

  return (
    <div className="page home-page">
      <TodoistTasksCard title="Tasks of the Day" profile={profile} googleIdToken={googleIdToken} />
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
                {section.id === 'finances' && !canViewFinances ? (
                  <button
                    type="button"
                    className="tile-link-button"
                    onClick={() => setFinanceAccessDeniedOpen(true)}
                  >
                    Open
                  </button>
                ) : (
                  <Link to={section.path} className="tile-link-button">
                    Open
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      {financeAccessDeniedOpen ? (
        <div className="finance-access-dialog-backdrop" role="presentation" onClick={() => setFinanceAccessDeniedOpen(false)}>
          <div
            className="finance-access-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-finance-access-dialog-title"
            aria-describedby="home-finance-access-dialog-body"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="home-finance-access-dialog-title">Access denied</h2>
            <p id="home-finance-access-dialog-body">
              You don&apos;t have access to Finances.
            </p>
            <button type="button" className="finance-dialog-close" onClick={() => setFinanceAccessDeniedOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
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

function getTodayDateInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const TASK_ORDER_KEY = 'todoist-task-order'

function getSavedTaskOrder(): string[] {
  try {
    const raw = window.localStorage.getItem(TASK_ORDER_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveTaskOrder(ids: string[]) {
  window.localStorage.setItem(TASK_ORDER_KEY, JSON.stringify(ids))
}

function applyTaskOrder(tasks: TodoistTask[], savedIds: string[]): TodoistTask[] {
  if (!savedIds.length) return tasks
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const ordered = savedIds.flatMap((id) => { const t = byId.get(id); return t ? [t] : [] })
  const seen = new Set(savedIds)
  return [...ordered, ...tasks.filter((t) => !seen.has(t.id))]
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
  const canEditTodoist = profile === 'admin' && googleEmail === TODOIST_EDITOR_EMAIL
  const canEditGrocery = profile === 'admin' && shouldUseAdminProfile(googleEmail)
  const canEditAny = canEditTodoist || canEditGrocery
  const canWrite = profile === 'admin' && googleEmail === TODOIST_EDITOR_EMAIL
  const canViewOriginalTabs = shouldUseAdminProfile(googleEmail)
  const [view, setView] = useState<'studying' | 'training' | 'todoist' | 'grocery' | 'meals'>('todoist')
  const [rows, setRows] = useState<TodoistTask[]>([])
  const [groceryRows, setGroceryRows] = useState<GroceryListRecord[]>([])
  const [mealPlanRows, setMealPlanRows] = useState<MealPlanRecord[]>([])
  const [trainingRows, setTrainingRows] = useState<TrainingRecord[]>([])
  const [studyRows, setStudyRows] = useState<CurrentStudyRecord[]>([])
  const [isDailyLoading, setIsDailyLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGroceryLoading, setIsGroceryLoading] = useState(true)
  const [isMealPlanLoading, setIsMealPlanLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [newTaskContent, setNewTaskContent] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState(() => getTodayDateInputValue())
  const [newTaskPriority, setNewTaskPriority] = useState(1)
  const [editedRows, setEditedRows] = useState<Record<string, { content: string; description: string; dueDate: string; priority: number }>>({})
  const [newCustomGroceryItem, setNewCustomGroceryItem] = useState('')
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [dropInsertIndex, setDropInsertIndex] = useState<number | null>(null)
  const draggingIndexRef = useRef<number | null>(null)
  const touchDropInsertRef = useRef<number | null>(null)
  const draggingElRef = useRef<HTMLDivElement | null>(null)
  const taskListRef = useRef<HTMLDivElement>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)
  const [longPressingIndex, setLongPressingIndex] = useState<number | null>(null)

  const todayKey = toDateOnlyKey(new Date().toISOString())

  const todaysTrainingRecord = useMemo(
    () => trainingRows.find((row) => toDateOnlyKey(row.date) === todayKey),
    [trainingRows, todayKey],
  )

  const todaysLessons = useMemo(() => {
    return studyRows
      .filter((row) => {
        if (toDateOnlyKey(row.date) !== todayKey) return false
        const topic = row.topic.trim()
        if (!topic) return false
        if (topic.toLowerCase() === 'rest day') return false
        if (/^take sample exam #\d+$/i.test(topic)) return false
        if (/^attempt \d+ problems$/i.test(topic)) return false
        return true
      })
      .sort((a, b) => a.topic.localeCompare(b.topic))
  }, [studyRows, todayKey])

  async function loadDailyData() {
    try {
      const [trainingData, studyData] = await Promise.all([getTrainingRecords(), getCurrentStudy()])
      setTrainingRows(trainingData)
      setStudyRows(studyData)
    } catch {
      setTrainingRows([])
      setStudyRows([])
    } finally {
      setIsDailyLoading(false)
    }
  }

  function performDrop(from: number, to: number) {
    setRows((prev) => {
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to > from ? to - 1 : to, 0, moved)
      saveTaskOrder(next.map((t) => t.id))
      return next
    })
    draggingIndexRef.current = null
    touchDropInsertRef.current = null
    draggingElRef.current = null
    setDraggingIndex(null)
    setDropInsertIndex(null)
  }

  function handleTaskDragStart(index: number) {
    draggingIndexRef.current = index
    setDraggingIndex(index)
  }

  function handleTaskDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const insertAfter = e.clientY > rect.top + rect.height / 2
    setDropInsertIndex(insertAfter ? index + 1 : index)
  }

  function handleTaskDrop() {
    if (draggingIndex !== null && dropInsertIndex !== null) {
      performDrop(draggingIndex, dropInsertIndex)
    } else {
      setDraggingIndex(null)
      setDropInsertIndex(null)
    }
  }

  function handleTouchDrop() {
    const from = draggingIndexRef.current
    const to = touchDropInsertRef.current
    if (from !== null && to !== null) {
      performDrop(from, to)
    } else {
      draggingIndexRef.current = null
      touchDropInsertRef.current = null
      draggingElRef.current = null
      setDraggingIndex(null)
      setDropInsertIndex(null)
    }
  }

  function handleTaskDragEnd() {
    draggingIndexRef.current = null
    touchDropInsertRef.current = null
    draggingElRef.current = null
    setDraggingIndex(null)
    setDropInsertIndex(null)
  }

  useEffect(() => {
    const container = taskListRef.current
    if (!container) return
    const onTouchMove = (e: TouchEvent) => {
      if (draggingIndexRef.current === null) return
      e.preventDefault()
      const touch = e.touches[0]
      const el = draggingElRef.current
      if (el) el.style.pointerEvents = 'none'
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      if (el) el.style.pointerEvents = ''
      if (!target) return
      const taskRow = target.closest('[data-task-index]') as HTMLElement | null
      if (taskRow) {
        const idx = parseInt(taskRow.dataset.taskIndex ?? '-1', 10)
        if (idx !== -1) {
          const rect = taskRow.getBoundingClientRect()
          const ins = touch.clientY > rect.top + rect.height / 2 ? idx + 1 : idx
          touchDropInsertRef.current = ins
          setDropInsertIndex(ins)
        }
      } else {
        const allRows = container.querySelectorAll('[data-task-index]')
        if (allRows.length > 0) {
          const lastRect = (allRows[allRows.length - 1] as HTMLElement).getBoundingClientRect()
          if (touch.clientY > lastRect.bottom) {
            touchDropInsertRef.current = allRows.length
            setDropInsertIndex(allRows.length)
          }
        }
      }
    }
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => container.removeEventListener('touchmove', onTouchMove)
  }, [])

  async function loadTasks() {
    try {
      const data = await getTasksOfTheDay()
      setRows(applyTaskOrder(data, getSavedTaskOrder()))
      setWriteError('')
    } catch (error) {
      setRows([])
      setWriteError(error instanceof Error ? error.message : 'Unable to load Todoist tasks')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadGroceryListForHome() {
    try {
      const data = await getGroceryList()
      setGroceryRows(data)
    } catch {
      setGroceryRows([])
    } finally {
      setIsGroceryLoading(false)
    }
  }

  async function loadMealPlanForHome() {
    try {
      const data = await getMealPlan()
      setMealPlanRows(data)
    } catch {
      setMealPlanRows([])
    } finally {
      setIsMealPlanLoading(false)
    }
  }

  useEffect(() => {
    void loadDailyData()
    void loadGroceryListForHome()
    void loadMealPlanForHome()

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
    if (isWriting || !todoistConfigured || !canEditTodoist) {
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
      setNewTaskDueDate(getTodayDateInputValue())
      setNewTaskPriority(1)
      await loadTasks()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to create task')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleSaveTask(task: TodoistTask) {
    if (isWriting || !todoistConfigured || !canEditTodoist) {
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

  async function handleToggleTrainingWorkout(period: 'morning' | 'evening') {
    if (!canWrite || !googleIdToken || !todaysTrainingRecord || isWriting) return
    const isMorning = period === 'morning'
    const nextCompleted = isMorning ? !todaysTrainingRecord.completed_morning : !todaysTrainingRecord.completed_evening
    const previousRows = trainingRows
    setIsWriting(true)
    setWriteError('')
    setTrainingRows((currentRows) =>
      currentRows.map((row) => {
        if (row.training_id !== todaysTrainingRecord.training_id) return row
        return isMorning ? { ...row, completed_morning: nextCompleted } : { ...row, completed_evening: nextCompleted }
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
    if (!canWrite || !googleIdToken || isWriting) return
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

  async function handleCompleteTask(task: TodoistTask) {
    if (isWriting || !todoistConfigured || !canEditTodoist) {
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

  const groceryGroups = useMemo(() => {
    const order: string[] = []
    const map: Record<string, GroceryListRecord[]> = {}
    for (const row of groceryRows) {
      const type = row.type.trim().toUpperCase() || 'ETC'
      if (!map[type]) {
        order.push(type)
        map[type] = []
      }
      map[type].push(row)
    }
    return order.map((type) => ({ type, items: map[type] }))
  }, [groceryRows])

  const includedGroceryGroups = useMemo(
    () =>
      groceryGroups
        .map(({ type, items }) => ({ type, items: items.filter((row) => row.include) }))
        .filter(({ items }) => items.length > 0),
    [groceryGroups],
  )

  const includedGroceryCount = useMemo(() => groceryRows.filter((row) => row.include).length, [groceryRows])

  async function handleToggleGroceryInclude(row: GroceryListRecord) {
    if (isWriting || !canEditGrocery || !googleIdToken) return
    setGroceryRows((prev) => prev.map((r) => r.item === row.item ? { ...r, include: !row.include } : r))
    setIsWriting(true)
    setWriteError('')
    try {
      await updateGroceryListItem(googleIdToken, {
        originalItem: row.item,
        item: row.item,
        type: row.type,
        completed: row.completed,
        include: !row.include,
      })
    } catch (error) {
      setGroceryRows((prev) => prev.map((r) => r.item === row.item ? { ...r, include: row.include } : r))
      setWriteError(error instanceof Error ? error.message : 'Unable to update grocery item')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleToggleGroceryCompleted(row: GroceryListRecord) {
    if (isWriting || !canEditGrocery || !googleIdToken) return
    setGroceryRows((prev) => prev.map((r) => r.item === row.item ? { ...r, completed: !row.completed } : r))
    setIsWriting(true)
    setWriteError('')
    try {
      await updateGroceryListItem(googleIdToken, {
        originalItem: row.item,
        item: row.item,
        type: row.type,
        completed: !row.completed,
        include: row.include,
      })
    } catch (error) {
      setGroceryRows((prev) => prev.map((r) => r.item === row.item ? { ...r, completed: row.completed } : r))
      setWriteError(error instanceof Error ? error.message : 'Unable to update grocery item')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleAddCustomGroceryItem() {
    if (isWriting || !canEditGrocery || !googleIdToken) return
    const item = newCustomGroceryItem.trim()
    if (!item) {
      setWriteError('Item name is required.')
      return
    }
    setGroceryRows((prev) => [...prev, { type: 'ETC', item, completed: false, include: true }])
    setNewCustomGroceryItem('')
    playItemAddedSound()
    setIsWriting(true)
    setWriteError('')
    try {
      await createGroceryListItem(googleIdToken, 'ETC', item, false, true)
    } catch (error) {
      setGroceryRows((prev) => prev.filter((r) => r.item !== item))
      setNewCustomGroceryItem(item)
      setWriteError(error instanceof Error ? error.message : 'Unable to add grocery item')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleDeselectAllGrocery() {
    if (isWriting || !canEditGrocery || !googleIdToken) return
    const included = groceryRows.filter((r) => r.include)
    if (included.length === 0) return
    setGroceryRows((prev) => prev.map((r) => ({ ...r, include: false })))
    setIsWriting(true)
    setWriteError('')
    try {
      await Promise.all(
        included.map((row) =>
          updateGroceryListItem(googleIdToken, {
            originalItem: row.item,
            item: row.item,
            type: row.type,
            completed: row.completed,
            include: false,
          }),
        ),
      )
    } catch (error) {
      setGroceryRows((prev) => prev.map((r) => {
        const wasIncluded = included.find((ir) => ir.item === r.item)
        return wasIncluded ? { ...r, include: true } : r
      }))
      setWriteError(error instanceof Error ? error.message : 'Unable to deselect items')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <article className="info-card home-todoist-card sheets-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          {canEditAny && (view === 'todoist' || view === 'grocery') ? (
            <button
              type="button"
              className={`section-edit-btn ${isEditing ? 'active' : ''}`}
              aria-pressed={isEditing}
              onClick={() => setIsEditing((value) => { if (!value) setIsCollapsed(false); return !value })}
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
            {isCollapsed ? '▸' : '▾'}
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          <div className="experience-toggle" role="tablist" aria-label="Tasks of the Day filter">
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
            {canViewOriginalTabs ? (
              <>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'todoist'}
                  className={`experience-toggle-btn ${view === 'todoist' ? 'active' : ''}`}
                  onClick={() => setView('todoist')}
                >
                  Todoist
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'grocery'}
                  className={`experience-toggle-btn ${view === 'grocery' ? 'active' : ''}`}
                  onClick={() => setView('grocery')}
                >
                  Grocery List
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={view === 'meals'}
                  className={`experience-toggle-btn ${view === 'meals' ? 'active' : ''}`}
                  onClick={() => setView('meals')}
                >
                  Meals
                </button>
              </>
            ) : null}
          </div>

          {view === 'training' ? <p className="sheets-meta">Workout(s) of the Day</p> : null}

          {view === 'studying' ? <p className="sheets-meta">Today&apos;s Lesson</p> : null}

          {view === 'todoist' ? <p className="sheets-meta">Scope: Today + overdue tasks from Todoist.</p> : null}

          {view === 'grocery' ? <p className="sheets-meta">Quick view of your grocery list.</p> : null}

          {view === 'meals' ? <p className="sheets-meta">Today's meal plan.</p> : null}

          {(view === 'training' || view === 'studying') && isDailyLoading ? (
            <p className="sheets-meta">Loading tasks...</p>
          ) : null}

          {view === 'training' && !isDailyLoading ? (
            todaysTrainingRecord ? (
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
            )
          ) : null}

          {view === 'studying' && !isDailyLoading ? (
            todaysLessons.length > 0 ? (
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
            )
          ) : null}

          {(view === 'training' || view === 'studying') && !canWrite ? (
            <p className="sheets-meta">Edit access restricted to Admin profile signed in as {TODOIST_EDITOR_EMAIL}.</p>
          ) : null}

          {view === 'todoist' && !todoistConfigured ? (
            <p className="sheets-error">Set VITE_TODOIST_API_TOKEN in your .env file, then restart the app.</p>
          ) : null}

          {view === 'todoist' && todoistConfigured && isLoading ? <p className="sheets-meta">Loading Todoist tasks...</p> : null}

          {view === 'grocery' && isGroceryLoading ? <p className="sheets-meta">Loading grocery list...</p> : null}

          {view === 'meals' && isMealPlanLoading ? <p className="sheets-meta">Loading meal plan...</p> : null}

          {view === 'todoist' && !canEditTodoist ? (
            <p className="sheets-meta">
              Edit access restricted to Admin profile signed in as {TODOIST_EDITOR_EMAIL}.
            </p>
          ) : null}

          {view === 'grocery' && !canEditGrocery ? (
            <p className="sheets-meta">Edit access restricted to approved admin Google accounts.</p>
          ) : null}

          {view === 'todoist' && todoistConfigured && rows.length > 0 ? (
            <div className="todoist-task-list" ref={taskListRef}>
              {rows.map((row, index) => (
                <React.Fragment key={`summary-${row.id}`}>
                  {draggingIndex !== null && dropInsertIndex === index && draggingIndex !== index && draggingIndex !== index - 1 ? (
                    <div className="todoist-drop-indicator" />
                  ) : null}
                  <div
                    className={[
                      'todoist-task-row',
                      row.is_completed ? 'is-completed' : '',
                      draggingIndex === index ? 'is-dragging' : '',
                      longPressingIndex === index ? 'is-long-pressing' : '',
                    ].filter(Boolean).join(' ')}
                    data-task-index={index}
                    data-priority={normalizePriority(row.priority)}
                    draggable
                    onDragStart={() => handleTaskDragStart(index)}
                    onDragOver={(e) => handleTaskDragOver(e, index)}
                    onDrop={handleTaskDrop}
                    onDragEnd={handleTaskDragEnd}
                    onContextMenu={(e) => e.preventDefault()}
                    onTouchStart={(e) => {
                      const touch = e.touches[0]
                      touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
                      const rowEl = e.currentTarget as HTMLDivElement
                      setLongPressingIndex(index)
                      longPressTimerRef.current = setTimeout(() => {
                        longPressTimerRef.current = null
                        setLongPressingIndex(null)
                        draggingElRef.current = rowEl
                        draggingIndexRef.current = index
                        setDraggingIndex(index)
                        if (typeof navigator.vibrate === 'function') navigator.vibrate(30)
                      }, 450)
                    }}
                    onTouchMove={(e) => {
                      if (longPressTimerRef.current !== null && touchStartPosRef.current) {
                        const touch = e.touches[0]
                        const dx = Math.abs(touch.clientX - touchStartPosRef.current.x)
                        const dy = Math.abs(touch.clientY - touchStartPosRef.current.y)
                        if (dx > 8 || dy > 8) {
                          clearTimeout(longPressTimerRef.current)
                          longPressTimerRef.current = null
                          setLongPressingIndex(null)
                        }
                      }
                    }}
                    onTouchEnd={() => {
                      if (longPressTimerRef.current !== null) {
                        clearTimeout(longPressTimerRef.current)
                        longPressTimerRef.current = null
                        setLongPressingIndex(null)
                      }
                      if (draggingIndexRef.current !== null) {
                        handleTouchDrop()
                      }
                    }}
                    onTouchCancel={() => {
                      if (longPressTimerRef.current !== null) {
                        clearTimeout(longPressTimerRef.current)
                        longPressTimerRef.current = null
                        setLongPressingIndex(null)
                      }
                      handleTaskDragEnd()
                    }}
                  >
                    <span className="todoist-drag-handle" aria-hidden="true">⠿</span>
                    <div className="todoist-task-content">
                      <p className={row.is_completed ? 'todoist-task-done' : ''}>{row.content}</p>
                      {row.description ? <p className="sheets-meta">{row.description}</p> : null}
                    </div>
                    <button
                      type="button"
                      className="todoist-complete-btn"
                      data-priority={normalizePriority(row.priority)}
                      onClick={() => void handleCompleteTask(row)}
                      disabled={isWriting || row.is_completed || !canEditTodoist}
                      title={canEditTodoist ? 'Mark complete' : undefined}
                      aria-label={`Complete: ${row.content}`}
                    />
                  </div>
                </React.Fragment>
              ))}
              {draggingIndex !== null && dropInsertIndex === rows.length && draggingIndex !== rows.length - 1 ? (
                <div className="todoist-drop-indicator" />
              ) : null}
              <div
                className="todoist-drop-tail"
                onDragOver={(e) => { e.preventDefault(); setDropInsertIndex(rows.length) }}
                onDrop={handleTaskDrop}
              />
            </div>
          ) : null}

          {/*
          {view === 'grocery' && groceryRows.length > 0 ? (
            <div className="sheets-table-shell">
              <table className="sheets-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Description</th>
                    <th>Completed</th>
                    {isEditing && canEditGrocery ? <th>Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {groceryRows.map((row, index) => (
                    <tr key={`home-grocery-${row.item}-${index}`}>
                      <td>
                        {isEditing && canEditGrocery ? (
                          <input
                            className="sheets-input sheets-table-input"
                            type="text"
                            value={editedGroceryRows[index]?.item ?? row.item}
                            onChange={(event) =>
                              setEditedGroceryRows((current) => ({
                                ...current,
                                [index]: {
                                  ...(current[index] ?? row),
                                  item: event.target.value,
                                },
                              }))
                            }
                            disabled={isWriting}
                          />
                        ) : (
                          <span style={{ textDecoration: row.completed ? 'line-through' : 'none' }}>{row.item}</span>
                        )}
                      </td>
                      <td>
                        {isEditing && canEditGrocery ? (
                          <input
                            className="sheets-input sheets-table-input"
                            type="text"
                            value={editedGroceryRows[index]?.description ?? row.description}
                            onChange={(event) =>
                              setEditedGroceryRows((current) => ({
                                ...current,
                                [index]: {
                                  ...(current[index] ?? row),
                                  description: event.target.value,
                                },
                              }))
                            }
                            disabled={isWriting}
                          />
                        ) : (
                          <span style={{ textDecoration: row.completed ? 'line-through' : 'none' }}>
                            {row.description || '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        {isEditing && canEditGrocery ? (
                          <input
                            type="checkbox"
                            checked={Boolean(editedGroceryRows[index]?.completed)}
                            onChange={(event) =>
                              setEditedGroceryRows((current) => ({
                                ...current,
                                [index]: {
                                  ...(current[index] ?? row),
                                  completed: event.target.checked,
                                },
                              }))
                            }
                            disabled={isWriting}
                          />
                        ) : (
                          <input
                            type="checkbox"
                            checked={Boolean(row.completed)}
                            onChange={() => {
                              void handleToggleGroceryCompleted(row)
                            }}
                            disabled={!canEditGrocery || !googleIdToken || isWriting}
                          />
                        )}
                      </td>
                      {isEditing && canEditGrocery ? (
                        <td>
                          <div className="sheets-table-actions">
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => void handleSaveGroceryItem(index, row)}
                              disabled={isWriting}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() => void handleDeleteGroceryItem(row)}
                              disabled={isWriting}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {view === 'grocery' && isEditing && canEditGrocery ? (
            <div className="sheets-editor">
              <div className="sheets-editor-row">
                <input
                  className="sheets-input"
                  type="text"
                  placeholder="Item"
                  value={newGroceryItem}
                  onChange={(event) => setNewGroceryItem(event.target.value)}
                  disabled={isWriting}
                />
                <input
                  className="sheets-input"
                  type="text"
                  placeholder="Description"
                  value={newGroceryDescription}
                  onChange={(event) => setNewGroceryDescription(event.target.value)}
                  disabled={isWriting}
                />
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => void handleCreateGroceryItem()}
                  disabled={isWriting}
                >
                  Add
                </button>
              </div>
            </div>
          ) : null}

          */}

          {view === 'grocery' && isEditing && canEditGrocery ? (
            <div className="grocery-catalog" aria-label="Grocery catalog">
              {includedGroceryCount > 0 ? (
                <div className="grocery-catalog-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => void handleDeselectAllGrocery()}
                    disabled={!googleIdToken || isWriting}
                  >
                    Deselect all
                  </button>
                </div>
              ) : null}
              {groceryGroups.map(({ type, items }) => (
                <div key={type} className="grocery-catalog-group">
                  <div className="grocery-catalog-type-header">{type}</div>
                  {items.map((row) => (
                    <div key={`${type}-${row.item}`} className="grocery-catalog-row">
                      <span className="grocery-catalog-item-name">{row.item}</span>
                      <button
                        type="button"
                        className={`grocery-catalog-toggle ${row.include ? 'included' : ''}`}
                        onClick={() => void handleToggleGroceryInclude(row)}
                        disabled={!googleIdToken || isWriting}
                        title={row.include ? 'Remove from list' : 'Add to list'}
                        aria-label={`${row.include ? 'Remove' : 'Add'} ${row.item}`}
                      >
                        {row.include ? '-' : '+'}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              <div className="grocery-catalog-group">
                <div className="grocery-catalog-type-header">ETC</div>
                <div className="grocery-catalog-row">
                  <input
                    className="sheets-input grocery-catalog-custom-input"
                    type="text"
                    placeholder="Item name"
                    value={newCustomGroceryItem}
                    onChange={(event) => setNewCustomGroceryItem(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleAddCustomGroceryItem()
                    }}
                    disabled={!googleIdToken || isWriting}
                  />
                  <button
                    type="button"
                    className="grocery-catalog-toggle"
                    onClick={() => void handleAddCustomGroceryItem()}
                    disabled={!googleIdToken || isWriting || !newCustomGroceryItem.trim()}
                    aria-label="Add custom grocery item"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {view === 'meals' && !isMealPlanLoading ? (() => {
            const today = normalizeWeekday(getTodayWeekdayName())
            const todayMeals = mealPlanRows.find((row) => {
              const weekday = normalizeWeekday(row.day_of_the_week)
              return weekday === today || weekday.slice(0, 3) === today.slice(0, 3)
            })
            return todayMeals ? (
              <div className="meal-plan-day-grid">
                <div className="meal-plan-day-item">
                  <p className="meal-plan-label">Breakfast</p>
                  <p>{todayMeals.breakfast || 'Not planned'}</p>
                </div>
                <div className="meal-plan-day-item">
                  <p className="meal-plan-label">Lunch</p>
                  <p>{todayMeals.lunch || 'Not planned'}</p>
                </div>
                <div className="meal-plan-day-item">
                  <p className="meal-plan-label">Dinner</p>
                  <p>{todayMeals.dinner || 'Not planned'}</p>
                </div>
                <div className="meal-plan-day-item">
                  <p className="meal-plan-label">Snack</p>
                  <p>{todayMeals.snack || 'Not planned'}</p>
                </div>
              </div>
            ) : (
              <p className="sheets-meta">No meal plan found for today.</p>
            )
          })() : null}

          {view === 'grocery' && !isEditing && includedGroceryGroups.length > 0 ? (
            <div className="grocery-list-view" aria-label="Active grocery list">
              {includedGroceryGroups.map(({ type, items }) => (
                <div key={type} className="grocery-catalog-group">
                  <div className="grocery-catalog-type-header">{type}</div>
                  {items.map((row) => (
                    <div key={`${type}-${row.item}`} className="grocery-catalog-row">
                      <span
                        className="grocery-catalog-item-name"
                        style={{ textDecoration: row.completed ? 'line-through' : 'none' }}
                      >
                        {row.item}
                      </span>
                      {canEditGrocery ? (
                        <input
                          type="checkbox"
                          checked={row.completed}
                          onChange={() => void handleToggleGroceryCompleted(row)}
                          disabled={!googleIdToken || isWriting}
                          title="Mark completed"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}

          {view === 'todoist' && todoistConfigured && canEditTodoist && isEditing ? (
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

          {view === 'todoist' && todoistConfigured && canEditTodoist && isEditing && rows.length > 0 ? (
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
                            disabled={isWriting || !canEditTodoist}
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
                            disabled={isWriting || !canEditTodoist}
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
                          disabled={isWriting || !canEditTodoist}
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
                            disabled={isWriting || !canEditTodoist}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() => void handleCompleteTask(row)}
                            disabled={isWriting || !canEditTodoist}
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

          {view === 'todoist' && todoistConfigured && !isLoading && rows.length === 0 && !writeError ? (
            <p className="sheets-meta">No tasks due today or overdue.</p>
          ) : null}

          {view === 'grocery' && !isEditing && !isGroceryLoading && groceryRows.length > 0 && includedGroceryCount === 0 ? (
            <p className="sheets-meta">No items added to this week&apos;s list. Tap Edit to add items.</p>
          ) : null}

          {view === 'grocery' && !isGroceryLoading && groceryRows.length === 0 ? (
            <p className="sheets-meta">No grocery items found.</p>
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
  canViewFinances = false,
}: {
  sectionId: SectionId
  profile: UserProfile
  googleIdToken: string
  canViewFinances?: boolean
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
      {sectionId === 'finances' ? (
        canViewFinances ? <FinancesHubCard idToken={googleIdToken} /> : <Navigate replace to="/" />
      ) : null}

      {sectionId === 'finances' ? null : section.cards.map((card) => {
        if (sectionId === 'mrpasionfruit' && card.title === 'Meet the Oreo Gang') {
          return <OreoGangCard key={card.title} title={card.title} />
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

type BarChartMonth = { key: string; label: string; bills: number; expenses: number; income: number }

function FinanceBarChart({
  data,
  selectedMonthIndex,
  onMonthClick,
}: {
  data: BarChartMonth[]
  selectedMonthIndex: number | null
  onMonthClick: (index: number) => void
}) {
  if (data.length === 0) return null

  const BAR_W = 12
  const BAR_GAP = 3
  const GROUP_PAD = 9
  const GROUP_W = GROUP_PAD * 2 + BAR_W * 3 + BAR_GAP * 2
  const TOP_PAD = 10
  const CHART_H = 150
  const LABEL_H = 22
  const SVG_H = TOP_PAD + CHART_H + LABEL_H
  const LEFT_PAD = 52
  const RIGHT_PAD = 8
  const svgW = LEFT_PAD + data.length * GROUP_W + RIGHT_PAD

  const maxVal = Math.max(...data.map((d) => Math.max(d.bills, d.expenses, d.income)), 1)

  function bh(val: number) {
    return val > 0 ? Math.max(2, (val / maxVal) * CHART_H) : 0
  }

  function fmtY(val: number) {
    if (val >= 1000) return `$${(val / 1000 % 1 === 0 ? (val / 1000).toFixed(0) : (val / 1000).toFixed(1))}k`
    return `$${Math.round(val)}`
  }

  return (
    <div className="finance-bar-chart-shell">
      <svg
        viewBox={`0 0 ${svgW} ${SVG_H}`}
        height={SVG_H}
        style={{ display: 'block', width: `max(100%, ${svgW}px)` }}
        aria-label="Monthly finances bar chart"
      >
        {[0.25, 0.5, 0.75, 1].map((pct) => {
          const y = TOP_PAD + CHART_H - pct * CHART_H
          return (
            <g key={pct}>
              <line x1={LEFT_PAD} y1={y} x2={svgW - RIGHT_PAD} y2={y} stroke="var(--border)" strokeDasharray="4 3" strokeWidth={1} />
              <text x={LEFT_PAD - 5} y={y + 4} textAnchor="end" fontSize={9} fill="var(--text-muted)">{fmtY(pct * maxVal)}</text>
            </g>
          )
        })}
        <line x1={LEFT_PAD} y1={TOP_PAD + CHART_H} x2={svgW - RIGHT_PAD} y2={TOP_PAD + CHART_H} stroke="var(--border)" strokeWidth={1} />
        {data.map((month, i) => {
          const gx = LEFT_PAD + i * GROUP_W + GROUP_PAD
          const isSelected = selectedMonthIndex === i
          const isDimmed = selectedMonthIndex !== null && !isSelected
          const bars: Array<{ val: number; fill: string }> = [
            { val: month.bills, fill: '#eab308' },
            { val: month.expenses, fill: '#ef4444' },
            { val: month.income, fill: '#22c55e' },
          ]
          return (
            <g key={month.key} onClick={() => onMonthClick(i)} style={{ cursor: 'pointer' }}>
              {isSelected && (
                <rect
                  x={gx - GROUP_PAD + 1}
                  y={TOP_PAD}
                  width={GROUP_W - 2}
                  height={CHART_H + LABEL_H - 4}
                  fill="var(--accent, #6366f1)"
                  opacity={0.08}
                  rx={3}
                />
              )}
              {bars.map((bar, j) => {
                const h = bh(bar.val)
                return (
                  <rect
                    key={j}
                    x={gx + j * (BAR_W + BAR_GAP)}
                    y={TOP_PAD + CHART_H - h}
                    width={BAR_W}
                    height={h}
                    fill={bar.fill}
                    rx={2}
                    opacity={isDimmed ? 0.28 : 0.9}
                  />
                )
              })}
              <text
                x={gx + (BAR_W * 3 + BAR_GAP * 2) / 2}
                y={TOP_PAD + CHART_H + 15}
                textAnchor="middle"
                fontSize={9}
                fontWeight={isSelected ? 700 : undefined}
                fill={isSelected ? 'var(--text-strong)' : 'var(--text-muted)'}
              >
                {month.label}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="finance-bar-chart-legend">
        {([['#eab308', 'Bills'], ['#ef4444', 'Expenses'], ['#22c55e', 'Income']] as const).map(([color, label]) => (
          <span key={label} className="finance-bar-chart-legend-item">
            <span className="finance-bar-chart-dot" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function FinancesHubCard({ idToken }: { idToken: string }) {
  type FinancesTab = 'dashboard' | 'calendar' | 'purchases'
  type FinancesSource = 'both' | 'abe' | 'ciara'
  const [activeTab, setActiveTab] = useState<FinancesTab>('dashboard')
  const [dashboardSource, setDashboardSource] = useState<FinancesSource>('both')
  const [abeTransactions, setAbeTransactions] = useState<FinanceTransactionRecord[]>([])
  const [ciaraTransactions, setCiaraTransactions] = useState<FinanceTransactionRecord[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true)
  const [transactionError, setTransactionError] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [dashboardMonth, setDashboardMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null)
  const [purchasesCategoryFilter, setPurchasesCategoryFilter] = useState('all')
  const [purchasesMonth, setPurchasesMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [allBudgetRecords, setAllBudgetRecords] = useState<BudgetTargetRecord[]>([])
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({})
  const [selectedTableMonth, setSelectedTableMonth] = useState<number | null>(() => new Date().getMonth())

  const budgetUser = dashboardSource === 'both' ? null : dashboardSource

  const budgetTargets = useMemo<Record<string, number>>(() => {
    const targets: Record<string, number> = {}
    const rows = budgetUser ? allBudgetRecords.filter((r) => r.user === budgetUser) : allBudgetRecords
    rows.forEach((r) => { targets[r.category] = (targets[r.category] ?? 0) + r.budget_amount })
    return targets
  }, [allBudgetRecords, budgetUser])

  useEffect(() => {
    async function loadBudgets() {
      try {
        const records = await getBudgetTargets()
        setAllBudgetRecords(records)
      } catch {}
    }
    void loadBudgets()
  }, [])

  useEffect(() => {
    const totals: Record<string, number> = {}
    const rows = budgetUser ? allBudgetRecords.filter((r) => r.user === budgetUser) : allBudgetRecords
    rows.forEach((r) => { totals[r.category] = (totals[r.category] ?? 0) + r.budget_amount })
    setBudgetDrafts(Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, String(v)])))
  }, [allBudgetRecords, budgetUser])

  useEffect(() => {
    async function loadTransactions() {
      try {
        const [abeData, ciaraData] = await Promise.all([getAbeTransactions(), getCiaraTransactions()])
        setAbeTransactions(abeData)
        setCiaraTransactions(ciaraData)
        setTransactionError('')
      } catch (error) {
        setAbeTransactions([])
        setCiaraTransactions([])
        setTransactionError(error instanceof Error ? error.message : 'Unable to load transactions')
      } finally {
        setIsLoadingTransactions(false)
      }
    }

    void loadTransactions()
  }, [])

  const dashboardRows = useMemo(() => {
    const withOwner = [
      ...abeTransactions.map((row) => ({ ...row, owner: 'Abe' as const })),
      ...ciaraTransactions.map((row) => ({ ...row, owner: 'Ciara' as const })),
    ]

    const filteredRows = withOwner.filter((row) => {
      if (dashboardSource === 'both') {
        return true
      }

      return dashboardSource === 'abe' ? row.owner === 'Abe' : row.owner === 'Ciara'
    })

    return filteredRows.sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0
      const bTime = b.date ? new Date(b.date).getTime() : 0
      return bTime - aTime
    })
  }, [abeTransactions, ciaraTransactions, dashboardSource])

  const BILL_CATEGORIES = ['rent', 'utilities', 'internet', 'insurance', 'student loans', 'groceries', 'gas', 'car', 'car insurance/maintenance', 'phone', 'subscriptions']
  const EXPENSE_CATEGORIES = ['hygiene', 'education', 'presents', 'restaurants', 'clothing', 'recreation', 'flights', 'hotels', 'excursions', 'miscellaneous']
  const INCOME_CATEGORIES = ['salary', 'cash', 'transfers', 'side hustles']

  const allMonthRows = useMemo(() => {
    const year = dashboardMonth.getFullYear()
    return dashboardRows.filter((row) => {
      if (!row.date) return false
      let rowYear: number, rowMonth: number
      const literalMatch = row.date.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (literalMatch) {
        rowYear = Number(literalMatch[1])
        rowMonth = Number(literalMatch[2]) - 1
      } else {
        const parsed = new Date(row.date)
        if (Number.isNaN(parsed.getTime())) return false
        rowYear = parsed.getFullYear()
        rowMonth = parsed.getMonth()
      }
      if (rowYear !== year) return false
      if (selectedTableMonth !== null && rowMonth !== selectedTableMonth) return false
      return true
    })
  }, [dashboardRows, dashboardMonth, selectedTableMonth])

  const budgetTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    const allCategories = [...BILL_CATEGORIES, ...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES]
    allCategories.forEach((cat) => {
      totals[cat] = 0
    })
    allMonthRows.forEach((row) => {
      const key = row.category?.toLowerCase().trim() ?? ''
      if (key in totals) {
        totals[key] += row.amount
      }
    })
    return totals
  }, [allMonthRows])

  function updateBudgetTarget(cat: string, raw: string) {
    if (!budgetUser) return
    const num = parseFloat(raw.replace(/[$,\s]/g, ''))
    const valid = Number.isFinite(num) && num > 0
    setBudgetDrafts((prev) => {
      const next = { ...prev }
      if (valid) next[cat] = String(num)
      else delete next[cat]
      return next
    })
    setAllBudgetRecords((prev) => {
      const filtered = prev.filter((r) => !(r.user === budgetUser && r.category === cat))
      return valid ? [...filtered, { user: budgetUser, category: cat, budget_amount: num }] : filtered
    })
    if (idToken) {
      void saveBudgetTarget(idToken, cat, valid ? num : null, budgetUser).catch(() => {})
    }
  }

  const monthlyTotals = useMemo<BarChartMonth[]>(() => {
    const year = dashboardMonth.getFullYear()
    const monthMap: Array<{ bills: number; expenses: number; income: number }> = Array.from(
      { length: 12 },
      () => ({ bills: 0, expenses: 0, income: 0 }),
    )
    const billSet = new Set(BILL_CATEGORIES)
    const expenseSet = new Set(EXPENSE_CATEGORIES)
    const incomeSet = new Set(INCOME_CATEGORIES)
    dashboardRows.forEach((row) => {
      if (!row.date) return
      let rowYear: number, rowMonth: number
      const literalMatch = row.date.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (literalMatch) {
        rowYear = Number(literalMatch[1])
        rowMonth = Number(literalMatch[2]) - 1
      } else {
        const parsed = new Date(row.date)
        if (Number.isNaN(parsed.getTime())) return
        rowYear = parsed.getFullYear()
        rowMonth = parsed.getMonth()
      }
      if (rowYear !== year) return
      const cat = row.category?.toLowerCase().trim() ?? ''
      if (billSet.has(cat)) monthMap[rowMonth].bills += row.amount
      else if (expenseSet.has(cat)) monthMap[rowMonth].expenses += row.amount
      else if (incomeSet.has(cat)) monthMap[rowMonth].income += row.amount
    })
    return monthMap.map((totals, m) => ({
      key: `${year}-${String(m + 1).padStart(2, '0')}`,
      label: new Date(year, m, 1).toLocaleDateString(undefined, { month: 'short' }),
      ...totals,
    }))
  }, [dashboardRows, dashboardMonth])

  const purchasesMonthLabel = purchasesMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const purchasesMonthRows = useMemo(() => {
    const year = purchasesMonth.getFullYear()
    const month = purchasesMonth.getMonth()
    return dashboardRows.filter((row) => {
      if (!row.date) return false
      const literalMatch = row.date.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (literalMatch) {
        return Number(literalMatch[1]) === year && Number(literalMatch[2]) === month + 1
      }
      const parsed = new Date(row.date)
      return !Number.isNaN(parsed.getTime()) && parsed.getFullYear() === year && parsed.getMonth() === month
    })
  }, [dashboardRows, purchasesMonth])

  const transactionsByDate = useMemo(() => {
    const next: Record<string, Array<FinanceTransactionRecord & { owner: 'Abe' | 'Ciara' }>> = {}

    dashboardRows.forEach((row) => {
      const literalDateMatch = row.date?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
      const key = literalDateMatch ? literalDateMatch[0] : toDateOnlyKey(row.date)
      if (!key) {
        return
      }

      if (!next[key]) {
        next[key] = []
      }

      next[key].push(row)
    })

    return next
  }, [dashboardRows])

  const calendarYear = calendarMonth.getFullYear()
  const calendarMonthIndex = calendarMonth.getMonth()
  const monthStart = new Date(calendarYear, calendarMonthIndex, 1)
  const monthEnd = new Date(calendarYear, calendarMonthIndex + 1, 0)
  const dayOffset = monthStart.getDay()
  const daysInMonth = monthEnd.getDate()
  const calendarCells: Array<number | null> = [
    ...Array.from({ length: dayOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  const calendarMonthLabel = calendarMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const todayKey = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })()

  const selectedDateTransactions = selectedDateKey ? (transactionsByDate[selectedDateKey] ?? []) : []

  return (
    <article className="finance-hub-card info-card">
      <div className="experience-toggle" role="tablist" aria-label="Finances views">
        <button
          type="button"
          className={`experience-toggle-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'dashboard'}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard view
        </button>
        <button
          type="button"
          className={`experience-toggle-btn ${activeTab === 'calendar' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'calendar'}
          onClick={() => setActiveTab('calendar')}
        >
          Calendar view
        </button>
        <button
          type="button"
          className={`experience-toggle-btn ${activeTab === 'purchases' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'purchases'}
          onClick={() => setActiveTab('purchases')}
        >
          Purchases tab
        </button>
      </div>

      <div className="finance-tabbar" role="group" aria-label="Dashboard source filter">
        <button
          type="button"
          className={`finance-tab ${dashboardSource === 'both' ? 'active' : ''}`}
          onClick={() => setDashboardSource('both')}
        >
          Both
        </button>
        <button
          type="button"
          className={`finance-tab ${dashboardSource === 'abe' ? 'active' : ''}`}
          onClick={() => setDashboardSource('abe')}
        >
          Abe
        </button>
        <button
          type="button"
          className={`finance-tab ${dashboardSource === 'ciara' ? 'active' : ''}`}
          onClick={() => setDashboardSource('ciara')}
        >
          Ciara
        </button>
      </div>

      {activeTab === 'dashboard' ? (
        <div className="finance-panel">
          <div className="finance-calendar-header">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setDashboardMonth((m) => new Date(m.getFullYear() - 1, m.getMonth(), 1))}
            >
              Prev
            </button>
            <p className="finance-calendar-month">{dashboardMonth.getFullYear()}</p>
            <button
              type="button"
              className="secondary-action"
              onClick={() => setDashboardMonth((m) => new Date(m.getFullYear() + 1, m.getMonth(), 1))}
            >
              Next
            </button>
          </div>

          {isLoadingTransactions ? <p className="sheets-meta">Loading dashboard transactions...</p> : null}
          {transactionError ? <p className="sheets-error">{transactionError}</p> : null}

          {!isLoadingTransactions && !transactionError ? (
            <>
              <FinanceBarChart
                data={monthlyTotals}
                selectedMonthIndex={selectedTableMonth}
                onMonthClick={(i) => setSelectedTableMonth((prev) => (prev === i ? null : i))}
              />
              <div className="finance-table-month-filter">
                <span className="finance-table-month-label">
                  {selectedTableMonth !== null
                    ? new Date(dashboardMonth.getFullYear(), selectedTableMonth, 1).toLocaleDateString(undefined, {
                        month: 'long',
                        year: 'numeric',
                      })
                    : `All of ${dashboardMonth.getFullYear()}`}
                </span>
                {selectedTableMonth !== null && (
                  <button
                    type="button"
                    className="finance-table-month-clear"
                    onClick={() => setSelectedTableMonth(null)}
                  >
                    Show all
                  </button>
                )}
              </div>
              {!budgetUser && (
                <p className="finance-budget-both-note">
                  Budget reflects the combined total for Abe and Ciara. Select a person to edit.
                </p>
              )}
              {(['Bills', 'Expenses', 'Income'] as const).map((group) => {
                const cats =
                  group === 'Bills' ? BILL_CATEGORIES : group === 'Expenses' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
                const groupTotal = cats.reduce((sum, cat) => sum + (budgetTotals[cat] ?? 0), 0)
                return (
                  <div key={group} className="finance-budget-group">
                    <div className="finance-budget-group-header">
                      <p className="finance-budget-group-label">{group}</p>
                      <p className="finance-budget-group-total">
                        {groupTotal.toLocaleString(undefined, {
                          style: 'currency',
                          currency: 'USD',
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="sheets-table-shell finance-budget-table-shell">
                      <table className="sheets-table finance-budget-table">
                        <thead>
                          <tr>
                            <th>Category</th>
                            <th>Total</th>
                            <th>Budget</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cats.map((cat) => {
                            const spent = budgetTotals[cat] ?? 0
                            const target = budgetTargets[cat]
                            const overBudget = target !== undefined && spent > target
                            const underBudget = target !== undefined && spent <= target
                            return (
                              <tr key={cat}>
                                <td>{cat.charAt(0).toUpperCase() + cat.slice(1)}</td>
                                <td
                                  style={{
                                    color: overBudget
                                      ? 'var(--error, #ef4444)'
                                      : underBudget
                                        ? 'var(--success, #22c55e)'
                                        : undefined,
                                    fontWeight: overBudget || underBudget ? 600 : undefined,
                                  }}
                                >
                                  {spent.toLocaleString(undefined, {
                                    style: 'currency',
                                    currency: 'USD',
                                    maximumFractionDigits: 2,
                                  })}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    className="finance-budget-input"
                                    min="0"
                                    step="1"
                                    value={budgetDrafts[cat] ?? ''}
                                    placeholder={budgetUser ? '—' : ''}
                                    disabled={!budgetUser}
                                    onChange={(e) =>
                                      setBudgetDrafts((prev) => ({ ...prev, [cat]: e.target.value }))
                                    }
                                    onBlur={(e) => updateBudgetTarget(cat, e.target.value)}
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'calendar' ? (
        <div className="finance-panel">
          <div className="finance-calendar-shell">
            <div className="finance-calendar-header">
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
                }}
              >
                Prev
              </button>
              <p className="finance-calendar-month">{calendarMonthLabel}</p>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
                }}
              >
                Next
              </button>
            </div>

            <div className="finance-calendar-weekdays" aria-hidden="true">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="finance-calendar-grid" aria-label="Financial calendar view">
              {calendarCells.map((day, index) => {
                if (!day) {
                  return <span key={`blank-${index}`} className="finance-calendar-empty" />
                }

                const dateKey = `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                const transactions = transactionsByDate[dateKey] ?? []
                const hasTransactions = transactions.length > 0

                return (
                  <button
                    key={dateKey}
                    type="button"
                    className={`finance-calendar-day ${hasTransactions ? 'has-transactions' : ''} ${dateKey === todayKey ? 'is-today' : ''}`}
                    onClick={() => {
                      if (hasTransactions) {
                        setSelectedDateKey(dateKey)
                      }
                    }}
                    aria-label={
                      hasTransactions
                        ? `${dateKey} has ${transactions.length} transaction${transactions.length === 1 ? '' : 's'}`
                        : `${dateKey} has no transactions`
                    }
                  >
                    <span>{day}</span>
                    {hasTransactions ? <span className="finance-transaction-dot" aria-hidden="true" /> : null}
                  </button>
                )
              })}
            </div>
          </div>

          {selectedDateKey && selectedDateTransactions.length > 0 ? (
            <div
              className="finance-access-dialog-backdrop"
              role="presentation"
              onClick={() => setSelectedDateKey(null)}
            >
              <div
                className="finance-access-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="finance-calendar-popup-title"
                onClick={(event) => event.stopPropagation()}
              >
                <h2 id="finance-calendar-popup-title">Transactions for {formatSheetDate(selectedDateKey)}</h2>
                <div className="sheets-table-shell">
                  <table className="sheets-table finance-popup-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th>Owner</th>
                        <th>Category</th>
                        <th>Card</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDateTransactions.map((row, index) => (
                        <tr key={`${row.owner}-${row.description}-${index}`}>
                          <td data-label="Description">{row.description}</td>
                          <td data-label="Owner">{row.owner}</td>
                          <td data-label="Category">{row.category || '—'}</td>
                          <td data-label="Card">{row.card || '—'}</td>
                          <td data-label="Amount">
                            {row.amount.toLocaleString(undefined, {
                              style: 'currency',
                              currency: 'USD',
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="finance-dialog-close" onClick={() => setSelectedDateKey(null)}>
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === 'purchases' ? (
        <div className="finance-panel">
          <div className="finance-calendar-header">
            <button
              type="button"
              className="secondary-action"
              onClick={() => setPurchasesMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            >
              Prev
            </button>
            <p className="finance-calendar-month">{purchasesMonthLabel}</p>
            <button
              type="button"
              className="secondary-action"
              onClick={() => setPurchasesMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            >
              Next
            </button>
          </div>

          {isLoadingTransactions ? <p className="sheets-meta">Loading purchases...</p> : null}
          {transactionError ? <p className="sheets-error">{transactionError}</p> : null}

          {!isLoadingTransactions && !transactionError ? (() => {
            const allCategories = Array.from(
              new Set(purchasesMonthRows.map((r) => r.category?.trim()).filter(Boolean))
            ).sort() as string[]

            const filtered =
              purchasesCategoryFilter === 'all'
                ? purchasesMonthRows
                : purchasesMonthRows.filter(
                    (r) => (r.category?.trim() ?? '') === purchasesCategoryFilter
                  )

            return (
              <>
                <div className="finance-purchases-filter">
                  <label htmlFor="purchases-category-select" className="finance-purchases-filter-label">
                    Category
                  </label>
                  <select
                    id="purchases-category-select"
                    className="sheets-table-input finance-purchases-select"
                    value={purchasesCategoryFilter}
                    onChange={(e) => setPurchasesCategoryFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {filtered.length > 0 ? (
                  <div className="sheets-table-shell finance-purchases-table-shell">
                    <table className="sheets-table finance-purchases-table" aria-label="Purchases transactions">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Owner</th>
                          <th>Description</th>
                          <th>Category</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((row, index) => (
                          <tr key={`${row.owner}-${row.date ?? 'nodate'}-${row.description}-${index}`}>
                            <td data-label="Date">{row.date ? formatShortDate(row.date) : 'Pending'}</td>
                            <td data-label="Owner">{row.owner}</td>
                            <td data-label="Description">{row.description}</td>
                            <td data-label="Category">{row.category || '—'}</td>
                            <td data-label="Amount">
                              {row.amount.toLocaleString(undefined, {
                                style: 'currency',
                                currency: 'USD',
                                maximumFractionDigits: 2,
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="sheets-meta">No purchases found for the selected month and category.</p>
                )}
              </>
            )
          })() : null}
        </div>
      ) : null}
    </article>
  )
}

const OREO_GANG_MEMBERS = ['Midnight', 'Pirouette', 'Inky'] as const
type OreoMember = typeof OREO_GANG_MEMBERS[number]

function OreoGangCard({ title }: { title: string }) {
  const [active, setActive] = useState<OreoMember>(OREO_GANG_MEMBERS[0])
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <article className="info-card section-page-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <button
          type="button"
          className="section-collapse-btn"
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((v) => !v)}
        >
          {isCollapsed ? '▸' : '▾'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className="experience-toggle" role="tablist" aria-label="Oreo Gang members">
            {OREO_GANG_MEMBERS.map((member) => (
              <button
                key={member}
                type="button"
                role="tab"
                aria-selected={active === member}
                className={`experience-toggle-btn ${active === member ? 'active' : ''}`}
                onClick={() => setActive(member)}
              >
                {member}
              </button>
            ))}
          </div>

          <div className="oreo-gang-member">
            <div className="oreo-gang-photo" aria-label={`Photo placeholder for ${active}`}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <circle cx="12" cy="12" r="3.5" />
                <path d="M16.5 5.5l1.5-1.5" />
              </svg>
              <span>Add photo</span>
            </div>
            <p className="oreo-gang-description">Description for {active} goes here.</p>
          </div>
        </>
      )}
    </article>
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
          {isCollapsed ? '▸' : '▾'}
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
          {isCollapsed ? '▸' : '▾'}
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

function formatShortDate(value?: string) {
  if (!value) return 'Pending'
  const literalMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (literalMatch) {
    return `${literalMatch[2]}/${literalMatch[3]}/${literalMatch[1].slice(2)}`
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const m = String(parsed.getMonth() + 1).padStart(2, '0')
  const d = String(parsed.getDate()).padStart(2, '0')
  const y = String(parsed.getFullYear()).slice(2)
  return `${m}/${d}/${y}`
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
              onClick={() => setIsEditing((value) => { if (!value) setIsCollapsed(false); return !value })}
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
            {isCollapsed ? '▸' : '▾'}
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
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [newItem, setNewItem] = useState('')
  const [editedItems, setEditedItems] = useState<Record<string, string>>({})
  const [page, setPage] = useState(0)

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
  const PAGE_SIZE = 10
  const totalPages = Math.ceil(visibleRows.length / PAGE_SIZE)
  const pagedRows = visibleRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  useEffect(() => { setPage(0) }, [rows])

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
              onClick={() => setIsEditing((value) => { if (!value) setIsCollapsed(false); return !value })}
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
            {isCollapsed ? '▸' : '▾'}
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          {isLoading ? <p className="sheets-meta">Loading list...</p> : null}

          {!isLoading && visibleRows.length > 0 ? (
            <p className="sheets-meta">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, visibleRows.length)} of {visibleRows.length} items
            </p>
          ) : null}
          <ol className="bucket-guest-list" start={page * PAGE_SIZE + 1}>
            {pagedRows.map((row) => (
              <li key={row.bucket_id} className={`bucket-guest-item ${row.completed ? 'completed' : ''}`}>
                <div className="bucket-guest-row">
                  <span>{row.item}</span>
                  <span className="bucket-guest-date">{formatSheetDate(row.completed_date)}</span>
                </div>
              </li>
            ))}
          </ol>
          {totalPages > 1 ? (
            <div className="bucket-page-nav">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Prev
              </button>
              <span className="bucket-page-label">
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, visibleRows.length)} of {visibleRows.length}
              </span>
              <button
                type="button"
                className="secondary-action"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
              >
                Next
              </button>
            </div>
          ) : null}

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
              onClick={() => setIsEditing((value) => { if (!value) setIsCollapsed(false); return !value })}
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
            {isCollapsed ? '▸' : '▾'}
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
  const [hasQuantityFilter, setHasQuantityFilter] = useState(true)
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
        const quantityMatches = !hasQuantityFilter || Number(row.quantity.trim()) > 0
        return storageMatches && typeMatches && quantityMatches
      })
      .sort((a, b) => {
        const typeCompare = a.row.type.localeCompare(b.row.type)
        if (typeCompare !== 0) {
          return typeCompare
        }

        return a.row.item.localeCompare(b.row.item)
      })
  }, [rows, storageFilter, typeFilter, hasQuantityFilter])

  function handleClearAll() {
    const next: Record<number, { storage: string; type: string; quantity: string }> = {}
    rows.forEach((row, index) => {
      next[index] = { storage: row.storage, type: row.type, quantity: '0' }
    })
    setEditedRows(next)
  }

  async function handleSaveAll() {
    if (!idToken || isWriting || !canWrite) return
    setIsWriting(true)
    setWriteError('')
    try {
      await Promise.all(
        rows.map((row, index) => {
          const draft = editedRows[index]
          if (!draft) return Promise.resolve()
          const nextStorage = draft.storage.trim()
          const nextType = draft.type.trim()
          const nextQuantity = draft.quantity.trim()
          if (nextStorage === row.storage && nextType === row.type && nextQuantity === row.quantity) {
            return Promise.resolve()
          }
          if (!nextStorage || !nextType) return Promise.resolve()
          return updateBackpackItem(idToken, {
            originalStorage: row.storage,
            originalType: row.type,
            originalItem: row.item,
            storage: nextStorage,
            type: nextType,
            quantity: nextQuantity,
          })
        }),
      )
      await loadBackpack()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to update backpack items')
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
              onClick={() => setIsEditing((value) => { if (!value) setIsCollapsed(false); return !value })}
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
            {isCollapsed ? '▸' : '▾'}
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
            <label className="backpack-quantity-filter">
              <input
                type="checkbox"
                checked={hasQuantityFilter}
                onChange={(e) => setHasQuantityFilter(e.target.checked)}
              />
              Has quantity
            </label>
          </div>

          <div className="sheets-table-shell">
            <table className="sheets-table">
              <thead>
                <tr>
                  {isEditing && canWrite ? <th>Storage</th> : null}
                  <th>Type</th>
                  <th>Item</th>
                  <th>Quantity</th>
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
                        <div className="backpack-quantity-stepper">
                          <button
                            type="button"
                            className="backpack-quantity-btn"
                            disabled={!idToken || isWriting || Number(editedRows[index]?.quantity ?? row.quantity) <= 0}
                            onClick={() =>
                              setEditedRows((current) => ({
                                ...current,
                                [index]: {
                                  storage: current[index]?.storage ?? row.storage,
                                  type: current[index]?.type ?? row.type,
                                  quantity: String(Math.max(0, Number(current[index]?.quantity ?? row.quantity) - 1)),
                                },
                              }))
                            }
                          >
                            −
                          </button>
                          <span className="backpack-quantity-value">
                            {editedRows[index]?.quantity ?? row.quantity}
                          </span>
                          <button
                            type="button"
                            className="backpack-quantity-btn"
                            disabled={!idToken || isWriting}
                            onClick={() =>
                              setEditedRows((current) => ({
                                ...current,
                                [index]: {
                                  storage: current[index]?.storage ?? row.storage,
                                  type: current[index]?.type ?? row.type,
                                  quantity: String(Number(current[index]?.quantity ?? row.quantity) + 1),
                                },
                              }))
                            }
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        row.quantity
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredRows.length === 0 ? <p className="sheets-meta">No backpack items match these filters.</p> : null}

          {isEditing && canWrite ? (
            <div className="backpack-edit-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={handleClearAll}
                disabled={isWriting}
              >
                Clear all
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => void handleSaveAll()}
                disabled={!idToken || isWriting}
              >
                {isWriting ? 'Saving...' : 'Save all'}
              </button>
            </div>
          ) : null}

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

const SLOT_ITEMS = {
  meat: [
    'Chicken Breast', 'Chicken Thighs', 'Ground Beef', 'Ribeye Steak', 'Salmon',
    'Shrimp', 'Pork Tenderloin', 'Ground Turkey', 'Lamb Chops', 'Tilapia',
    'Tuna Steak', 'Cod', 'Italian Sausage', 'Duck Breast', 'Pork Chops',
    'Beef Short Ribs', 'Scallops', 'Mahi Mahi',
  ],
  sauce: [
    'Garlic Butter', 'Teriyaki', 'Marinara', 'Pesto', 'Alfredo', 'BBQ',
    'Chimichurri', 'Honey Mustard', 'Soy Ginger', 'Lemon Herb', 'Buffalo',
    'Tahini', 'Miso Glaze', 'Tikka Masala', 'Salsa Verde', 'Coconut Curry',
    'Béarnaise', 'Brown Butter', 'Orange Glaze', 'Romesco',
  ],
  carb: [
    'White Rice', 'Brown Rice', 'Pasta', 'Quinoa', 'Mashed Potatoes',
    'Sweet Potato', 'Roasted Potatoes', 'Rice Noodles', 'Couscous',
    'Risotto', 'Polenta', 'Farro', 'Gnocchi', 'Fried Rice',
    'Flour Tortillas', 'Sourdough Bread', 'Udon Noodles', 'Orzo',
  ],
  veg: [
    'Broccoli', 'Spinach', 'Asparagus', 'Brussels Sprouts', 'Bell Peppers',
    'Zucchini', 'Green Beans', 'Kale', 'Carrots', 'Cauliflower',
    'Mushrooms', 'Eggplant', 'Snow Peas', 'Bok Choy', 'Corn',
    'Edamame', 'Roasted Tomatoes', 'Beets', 'Artichoke', 'Sugar Snap Peas',
  ],
} as const

type SlotCategory = keyof typeof SLOT_ITEMS
const SLOT_CATEGORIES: SlotCategory[] = ['meat', 'sauce', 'carb', 'veg']
const SLOT_LABELS: Record<SlotCategory, string> = { meat: 'Meat', sauce: 'Sauce', carb: 'Carb', veg: 'Veg' }
const SLOT_STOP_DELAYS: Record<SlotCategory, number> = { meat: 1800, sauce: 2300, carb: 2800, veg: 3300 }

function MealRandomizerCard({ title }: { title: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [display, setDisplay] = useState<Record<SlotCategory, string>>({
    meat: SLOT_ITEMS.meat[0], sauce: SLOT_ITEMS.sauce[0],
    carb: SLOT_ITEMS.carb[0], veg: SLOT_ITEMS.veg[0],
  })
  const [tickKey, setTickKey] = useState<Record<SlotCategory, number>>({ meat: 0, sauce: 0, carb: 0, veg: 0 })
  const [reelSpinning, setReelSpinning] = useState<Record<SlotCategory, boolean>>({ meat: false, sauce: false, carb: false, veg: false })

  const intervalsRef = useRef<Partial<Record<SlotCategory, ReturnType<typeof setInterval>>>>({})
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    return () => {
      for (const id of Object.values(intervalsRef.current)) if (id) clearInterval(id)
      for (const id of timeoutsRef.current) clearTimeout(id)
    }
  }, [])

  function randomItem(cat: SlotCategory) {
    const arr = SLOT_ITEMS[cat] as readonly string[]
    return arr[Math.floor(Math.random() * arr.length)]
  }

  function spin() {
    if (spinning) return
    setSpinning(true)
    setReelSpinning({ meat: true, sauce: true, carb: true, veg: true })

    for (const cat of SLOT_CATEGORIES) {
      intervalsRef.current[cat] = setInterval(() => {
        const item = randomItem(cat)
        setDisplay((prev) => ({ ...prev, [cat]: item }))
        setTickKey((prev) => ({ ...prev, [cat]: prev[cat] + 1 }))
      }, 80)

      const t = setTimeout(() => {
        clearInterval(intervalsRef.current[cat])
        const final = randomItem(cat)
        setDisplay((prev) => ({ ...prev, [cat]: final }))
        setTickKey((prev) => ({ ...prev, [cat]: prev[cat] + 1 }))
        setReelSpinning((prev) => ({ ...prev, [cat]: false }))
        if (cat === 'veg') setSpinning(false)
      }, SLOT_STOP_DELAYS[cat])
      timeoutsRef.current.push(t)
    }
  }

  return (
    <article className="info-card section-page-card meal-randomizer-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <button
          type="button"
          className="section-collapse-btn"
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((v) => !v)}
        >
          {isCollapsed ? '▸' : '▾'}
        </button>
      </div>

      {!isCollapsed && (
        <>
          <div className="meal-randomizer-reels">
            {SLOT_CATEGORIES.map((cat) => (
              <div key={cat} className="meal-randomizer-reel">
                <span className="meal-randomizer-reel-label">{SLOT_LABELS[cat]}</span>
                <div className={`meal-randomizer-window${reelSpinning[cat] ? ' spinning' : ''}`}>
                  <div className="meal-randomizer-shine" />
                  <span key={tickKey[cat]} className="meal-randomizer-item">
                    {display[cat]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="meal-randomizer-spin-btn"
            disabled={spinning}
            onClick={spin}
          >
            {spinning ? 'Spinning…' : 'Randomize'}
          </button>
        </>
      )}
    </article>
  )
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
              onClick={() => setIsEditing((value) => { if (!value) setIsWeeklyExpanded(true); return !value })}
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

function GroceryListCard({
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
  const [rows, setRows] = useState<GroceryListRecord[]>([])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [newCustomItem, setNewCustomItem] = useState('')

  async function loadGroceryList() {
    try {
      const data = await getGroceryList()
      setRows(data)
      setWriteError('')
    } catch {
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadGroceryList()
  }, [])

  // Group rows by type, preserving sheet order within each type
  const groupedRows = useMemo(() => {
    const order: string[] = []
    const map: Record<string, GroceryListRecord[]> = {}
    for (const row of rows) {
      const t = row.type.trim().toUpperCase() || 'ETC'
      if (!map[t]) {
        order.push(t)
        map[t] = []
      }
      map[t].push(row)
    }
    return order.map((t) => ({ type: t, items: map[t] }))
  }, [rows])

  // Items on the active grocery list (include=true)
  const includedRows = useMemo(() => rows.filter((r) => r.include), [rows])

  async function handleToggleInclude(row: GroceryListRecord) {
    if (!idToken || isWriting || !canWrite) return
    setRows((prev) => prev.map((r) => r.item === row.item ? { ...r, include: !row.include } : r))
    setIsWriting(true)
    setWriteError('')
    try {
      await updateGroceryListItem(idToken, {
        originalItem: row.item,
        item: row.item,
        type: row.type,
        completed: row.completed,
        include: !row.include,
      })
    } catch (error) {
      setRows((prev) => prev.map((r) => r.item === row.item ? { ...r, include: row.include } : r))
      setWriteError(error instanceof Error ? error.message : 'Unable to update grocery item')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleToggleCompleted(row: GroceryListRecord) {
    if (!idToken || isWriting || !canWrite) return
    setRows((prev) => prev.map((r) => r.item === row.item ? { ...r, completed: !row.completed } : r))
    setIsWriting(true)
    setWriteError('')
    try {
      await updateGroceryListItem(idToken, {
        originalItem: row.item,
        item: row.item,
        type: row.type,
        completed: !row.completed,
        include: row.include,
      })
    } catch (error) {
      setRows((prev) => prev.map((r) => r.item === row.item ? { ...r, completed: row.completed } : r))
      setWriteError(error instanceof Error ? error.message : 'Unable to update grocery item')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleAddCustomItem() {
    if (!idToken || isWriting || !canWrite) return
    const item = newCustomItem.trim()
    if (!item) {
      setWriteError('Item name is required.')
      return
    }
    setRows((prev) => [...prev, { type: 'ETC', item, completed: false, include: true }])
    setNewCustomItem('')
    playItemAddedSound()
    setIsWriting(true)
    setWriteError('')
    try {
      await createGroceryListItem(idToken, 'ETC', item, false, true)
    } catch (error) {
      setRows((prev) => prev.filter((r) => r.item !== item))
      setNewCustomItem(item)
      setWriteError(error instanceof Error ? error.message : 'Unable to add grocery item')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleDeselectAll() {
    if (!idToken || isWriting || !canWrite) return
    const included = rows.filter((r) => r.include)
    if (included.length === 0) return
    setRows((prev) => prev.map((r) => ({ ...r, include: false })))
    setIsWriting(true)
    setWriteError('')
    try {
      await Promise.all(
        included.map((row) =>
          updateGroceryListItem(idToken, {
            originalItem: row.item,
            item: row.item,
            type: row.type,
            completed: row.completed,
            include: false,
          }),
        ),
      )
    } catch (error) {
      setRows((prev) => prev.map((r) => {
        const wasIncluded = included.find((ir) => ir.item === r.item)
        return wasIncluded ? { ...r, include: true } : r
      }))
      setWriteError(error instanceof Error ? error.message : 'Unable to deselect items')
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
              onClick={() => setIsEditing((value) => { if (!value) setIsCollapsed(false); return !value })}
              title="Edit grocery list"
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
            {isCollapsed ? '▸' : '▾'}
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          {isLoading ? <p className="sheets-meta">Loading grocery list...</p> : null}

          {!isLoading && rows.length === 0 && !isEditing ? (
            <p className="sheets-meta">{fallbackBody || 'No grocery items yet.'}</p>
          ) : null}

          {!canWrite ? (
            <p className="sheets-meta">Edit access restricted to approved admin Google accounts.</p>
          ) : null}

          {canWrite && !idToken ? (
            <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
          ) : null}

          {/* Edit/catalog mode: browse all items grouped by type, toggle include */}
          {isEditing && canWrite ? (
            <div className="grocery-catalog">
              {includedRows.length > 0 ? (
                <div className="grocery-catalog-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => void handleDeselectAll()}
                    disabled={!idToken || isWriting}
                  >
                    Deselect all
                  </button>
                </div>
              ) : null}
              {groupedRows.map(({ type, items }) => (
                <div key={type} className="grocery-catalog-group">
                  <div className="grocery-catalog-type-header">{type}</div>
                  {items.map((row) => (
                    <div key={row.item} className="grocery-catalog-row">
                      <span className="grocery-catalog-item-name">{row.item}</span>
                      <button
                        type="button"
                        className={`grocery-catalog-toggle ${row.include ? 'included' : ''}`}
                        onClick={() => void handleToggleInclude(row)}
                        disabled={!idToken || isWriting}
                        title={row.include ? 'Remove from list' : 'Add to list'}
                        aria-label={`${row.include ? 'Remove' : 'Add'} ${row.item}`}
                      >
                        {row.include ? '−' : '+'}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              {/* Add a custom item not in the catalog */}
              <div className="grocery-catalog-group">
                <div className="grocery-catalog-type-header">Add custom item</div>
                <div className="grocery-catalog-row">
                  <input
                    className="sheets-input grocery-catalog-custom-input"
                    type="text"
                    placeholder="Item name"
                    value={newCustomItem}
                    onChange={(event) => setNewCustomItem(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleAddCustomItem()
                    }}
                    disabled={!idToken || isWriting}
                  />
                  <button
                    type="button"
                    className="grocery-catalog-toggle"
                    onClick={() => void handleAddCustomItem()}
                    disabled={!idToken || isWriting || !newCustomItem.trim()}
                    aria-label="Add custom grocery item"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Normal view: show included items grouped by type */}
          {!isEditing && includedRows.length > 0 ? (
            <div className="grocery-list-view">
              {groupedRows
                .map(({ type, items }) => ({ type, items: items.filter((r) => r.include) }))
                .filter(({ items }) => items.length > 0)
                .map(({ type, items }) => (
                  <div key={type} className="grocery-catalog-group">
                    <div className="grocery-catalog-type-header">{type}</div>
                    {items.map((row) => (
                      <div key={row.item} className="grocery-catalog-row">
                        <span
                          className="grocery-catalog-item-name"
                          style={{ textDecoration: row.completed ? 'line-through' : 'none' }}
                        >
                          {row.item}
                        </span>
                        {canWrite ? (
                          <input
                            type="checkbox"
                            checked={row.completed}
                            onChange={() => void handleToggleCompleted(row)}
                            disabled={!idToken || isWriting}
                            title="Mark completed"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          ) : null}

          {!isEditing && !isLoading && includedRows.length === 0 && rows.length > 0 ? (
            <p className="sheets-meta">No items added to this week&apos;s list. Tap ✎ to add items.</p>
          ) : null}

          {writeError ? <p className="sheets-error">{writeError}</p> : null}
        </>
      ) : null}
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

  const [rows, setRows] = useState<TrainingRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [yearFilter, setYearFilter] = useState(currentYear)
  const [mobilePage, setMobilePage] = useState(() => Math.floor(currentDate.getMonth() / 3))
  const [desktopPage, setDesktopPage] = useState(() => currentDate.getMonth() >= 6 ? 1 : 0)

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

        return true
      })
      .sort((a, b) => {
        const aDate = parseTrainingDate(a.date)?.getTime() ?? 0
        const bDate = parseTrainingDate(b.date)?.getTime() ?? 0
        return aDate - bDate
      })
  }, [rows, yearFilter])

  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const monthGroups = useMemo(() => {
    const grouped = new Map<number, TrainingRecord[]>()
    for (const row of filteredRows) {
      const parsedDate = parseTrainingDate(row.date)
      if (!parsedDate) continue
      const m = parsedDate.getMonth()
      const curr = grouped.get(m) ?? []
      curr.push(row)
      grouped.set(m, curr)
    }
    return MONTH_LABELS.map((label, monthIndex) => {
      // How many empty Mon-anchored cells precede day 1 (Mon=0 … Sun=6)
      const firstDayOffset = (new Date(Number(yearFilter), monthIndex, 1).getDay() + 6) % 7
      return { monthIndex, label, rows: grouped.get(monthIndex) ?? [], firstDayOffset }
    })
  }, [filteredRows, yearFilter])

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
          <div className="training-log-main">
            <div className="training-log-grid" aria-label="Training activity tiles by month">
              <div className="training-log-desktop-page-nav">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setDesktopPage(0)}
                  disabled={desktopPage === 0}
                >
                  ‹
                </button>
                <span className="sheets-meta">{desktopPage === 0 ? 'Jan – Jun' : 'Jul – Dec'}</span>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setDesktopPage(1)}
                  disabled={desktopPage === 1}
                >
                  ›
                </button>
              </div>

              <div className="training-log-page-nav">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setMobilePage((p) => Math.max(0, p - 1))}
                  disabled={mobilePage === 0}
                >
                  ‹
                </button>
                <span className="sheets-meta">{['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Oct – Dec'][mobilePage]}</span>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setMobilePage((p) => Math.min(3, p + 1))}
                  disabled={mobilePage === 3}
                >
                  ›
                </button>
              </div>

              <div className="training-log-tiles-row">
                <div className="training-log-grid-panel">
                  {monthGroups.map((group) => {
                    const mobilePg = Math.floor(group.monthIndex / 3)
                    const desktopPg = Math.floor(group.monthIndex / 6)
                    return (
                      <div
                        key={group.monthIndex}
                        className={[
                          'training-log-month-col',
                          mobilePg !== mobilePage ? 'training-log-month-col--hidden' : '',
                          desktopPg !== desktopPage ? 'training-log-month-col--desktop-hidden' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        <div className="training-log-month-label" aria-label={`Month ${group.label}`}>{group.label}</div>
                        <div
                          className="training-log-row-tiles"
                          role="list"
                          aria-label={`${group.label} training activity`}
                        >
                          {group.rows.map((row) => {
                            const tileLevel = getTrainingTileLevel(row)
                            const label = `${formatSheetDate(row.date)} activity level ${tileLevel}`
                            const parsedDate = parseTrainingDate(row.date)
                            const gridColumn = parsedDate ? (parsedDate.getDay() + 6) % 7 + 1 : undefined
                            const gridRow = parsedDate
                              ? Math.floor((parsedDate.getDate() - 1 + group.firstDayOffset) / 7) + 1
                              : undefined

                            return (
                              <div
                                key={row.training_id}
                                role="listitem"
                                className={`training-log-tile level-${tileLevel}`}
                                style={{ gridColumn, gridRow }}
                                aria-label={label}
                                title={label}
                                data-training-id={row.training_id}
                                data-level={String(tileLevel)}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="training-log-year-picker" role="listbox" aria-label="Select year">
                  {selectableYears.map((year) => (
                    <button
                      key={year}
                      type="button"
                      role="option"
                      aria-selected={yearFilter === String(year)}
                      className={`training-log-year-btn${yearFilter === String(year) ? ' active' : ''}`}
                      onClick={() => setYearFilter(String(year))}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>

              <p className="sheets-meta">Light: one workout completed or rest day. Dark: both workouts completed.</p>
            </div>
          </div>

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
              onClick={() => setIsEditing((value) => { if (!value) setIsCollapsed(false); return !value })}
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
            {isCollapsed ? '▸' : '▾'}
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
      <div className="experience-header">
        <p className="experience-role">{entry.exam} — {entry.topic}</p>
        <p className="experience-date">{entry.status}</p>
      </div>
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
  const isFSU = entry.institution.toLowerCase().includes('florida state')
  return (
    <li className="experience-item">
      {isFSU && (
        <span className="experience-icon education-fsu-badge" aria-label="Florida State University">
          FSU
        </span>
      )}
      <div className="experience-body">
        <div className="experience-header">
          <p className="experience-role">{entry.institution}</p>
          <p className="experience-date">{entry.date}</p>
        </div>
        <p className="experience-sub education-degree">
          {entry.degree}
          {entry.gpa ? <span className="education-gpa">GPA: {entry.gpa}</span> : null}
        </p>
        {entry.coursework ? <p className="experience-note">Relevant Coursework: {entry.coursework}</p> : null}
      </div>
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

function getExperienceIcon(position: string): { paths: React.ReactNode; color: string } {
  const p = position.toLowerCase()

  if (p.includes('data') || p.includes('analyst') || p.includes('bi')) {
    return {
      color: '#4f46e5',
      paths: (
        <>
          <rect x="3" y="12" width="4" height="9" rx="1" />
          <rect x="10" y="7" width="4" height="14" rx="1" />
          <rect x="17" y="3" width="4" height="18" rx="1" />
        </>
      ),
    }
  }

  if (p.includes('developer') || p.includes('software') || p.includes('engineer')) {
    return {
      color: '#7c3aed',
      paths: (
        <>
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </>
      ),
    }
  }

  if (p.includes('security') || p.includes('cyber')) {
    return {
      color: '#ea580c',
      paths: <path d="M12 2l8 4v6c0 5-4 9-8 10C8 21 4 17 4 12V6z" />,
    }
  }

  if (p.includes('information technology') || p.includes('support') || p.includes(' it ')) {
    return {
      color: '#0891b2',
      paths: (
        <>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </>
      ),
    }
  }

  if (p.includes('tutor') || p.includes('teacher') || p.includes('instructor') || p.includes('math')) {
    return {
      color: '#16a34a',
      paths: (
        <>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </>
      ),
    }
  }

  if (p.includes('lifeguard') || p.includes('guard') || p.includes('rescue')) {
    return {
      color: '#0284c7',
      paths: (
        <>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
        </>
      ),
    }
  }

  return {
    color: '#6b7280',
    paths: (
      <>
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </>
    ),
  }
}

function ExperienceRow({
  entry,
  showDuration,
}: {
  entry: ProfessionalExperienceEntry
  showDuration: boolean
}) {
  const dateLabel = `${entry.date}${showDuration ? formatDuration(entry.date) : ''}`
  const icon = getExperienceIcon(entry.position)

  return (
    <li className="experience-item">
      <span className="experience-icon" style={{ color: icon.color }} aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icon.paths}
        </svg>
      </span>
      <div className="experience-body">
        <div className="experience-header">
          <p className="experience-role">{entry.position} - {entry.company}</p>
          <p className="experience-date">{dateLabel}</p>
        </div>
        {entry.note ? <p className="experience-note">{entry.note}</p> : null}
      </div>
    </li>
  )
}

function MilestonesCard({ title }: { title: string }) {
  const [records, setRecords] = useState<PersonalTrainingRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [category, setCategory] = useState<string>('all')
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    let isMounted = true
    getPersonalTraining()
      .then((data) => {
        if (isMounted) setRecords(data.filter((r) => r.type === 'milestone'))
      })
      .catch(() => {
        if (isMounted) setRecords([])
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })
    return () => { isMounted = false }
  }, [])

  const categories = useMemo(() => {
    const seen = new Set<string>()
    for (const r of records) {
      if (r.category) seen.add(r.category)
    }
    return Array.from(seen)
  }, [records])

  const visible = useMemo(
    () => (category === 'all' ? records : records.filter((r) => r.category === category)),
    [records, category],
  )

  return (
    <article className="info-card section-page-card milestones-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <button
          type="button"
          className="section-collapse-btn"
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((c) => !c)}
        >
          {isCollapsed ? '▸' : '▾'}
        </button>
      </div>

      {!isCollapsed && (
        isLoading ? (
          <p className="sheets-meta">Loading milestones...</p>
        ) : records.length === 0 ? (
          <p className="sheets-meta">No milestone data found.</p>
        ) : (
          <>
            <div className="milestones-toggle" role="tablist" aria-label="Milestones category filter">
              <button
                type="button"
                role="tab"
                aria-selected={category === 'all'}
                className={`milestones-toggle-btn ${category === 'all' ? 'active' : ''}`}
                onClick={() => setCategory('all')}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={category === cat}
                  className={`milestones-toggle-btn ${category === cat ? 'active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="milestones-list-scroll">
              <ul className="milestones-list">
                {visible.map((entry) => (
                  <li key={`${entry.category}-${entry.name}`} className="milestone-item">
                    <div className="milestone-content">
                      <p className="milestone-name">{entry.name}</p>
                      <p className="milestone-value">{entry.value || '—'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )
      )}
    </article>
  )
}

function EquipmentCard({ title }: { title: string }) {
  const [records, setRecords] = useState<PersonalTrainingRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [category, setCategory] = useState<string>('all')
  const [isCollapsed, setIsCollapsed] = useState(false)

  useEffect(() => {
    let isMounted = true
    getPersonalTraining()
      .then((data) => {
        if (isMounted) setRecords(data.filter((r) => r.type === 'equipment'))
      })
      .catch(() => {
        if (isMounted) setRecords([])
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })
    return () => { isMounted = false }
  }, [])

  const categories = useMemo(() => {
    const seen = new Set<string>()
    for (const r of records) {
      if (r.category) seen.add(r.category)
    }
    return Array.from(seen).sort()
  }, [records])

  const visible = useMemo(
    () => (category === 'all' ? records : records.filter((r) => r.category === category)),
    [records, category],
  )

  return (
    <article className="info-card section-page-card milestones-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <button
          type="button"
          className="section-collapse-btn"
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((c) => !c)}
        >
          {isCollapsed ? '▸' : '▾'}
        </button>
      </div>

      {!isCollapsed && (
        isLoading ? (
          <p className="sheets-meta">Loading equipment...</p>
        ) : records.length === 0 ? (
          <p className="sheets-meta">No equipment data found.</p>
        ) : (
          <>
            <div className="milestones-toggle" role="tablist" aria-label="Equipment category filter">
              <button
                type="button"
                role="tab"
                aria-selected={category === 'all'}
                className={`milestones-toggle-btn ${category === 'all' ? 'active' : ''}`}
                onClick={() => setCategory('all')}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={category === cat}
                  className={`milestones-toggle-btn ${category === cat ? 'active' : ''}`}
                  onClick={() => setCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="milestones-list-scroll">
              <ul className="milestones-list">
                {visible.map((item) => (
                  <li key={`${item.category}-${item.name}`} className="milestone-item">
                    <div className="milestone-content">
                      <p className="milestone-name">{item.name}</p>
                      <p className="milestone-value">{item.value || '—'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )
      )}
    </article>
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

function playItemAddedSound() {
  try {
    const ctx = new AudioContext()
    const t = ctx.currentTime
    function tone(freq: number, start: number) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.18, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22)
      osc.start(start)
      osc.stop(start + 0.22)
    }
    tone(880, t)
    tone(1320, t + 0.11)
  } catch {
    // audio unavailable
  }
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

type HealthSource = 'garmin' | 'ringconn' | 'apple'

const HEALTH_SOURCE_LABELS: Record<HealthSource, string> = {
  garmin:   'Garmin',
  ringconn: 'Ringconn',
  apple:    'Apple Health',
}

const GARMIN_COLS:   (keyof GarminHealthRecord)[]   = ['date', 'activity_type', 'title', 'distance_km', 'duration_min', 'avg_hr', 'max_hr', 'calories', 'tss']
const RINGCONN_COLS: (keyof RingconnHealthRecord)[] = ['date', 'sleep_score', 'sleep_duration_h', 'deep_sleep_h', 'rem_sleep_h', 'resting_hr', 'hrv', 'spo2', 'steps', 'calories']
const APPLE_COLS:    (keyof AppleHealthRecord)[]    = ['date', 'steps', 'resting_hr', 'hrv_sdnn', 'active_calories', 'sleep_h', 'spo2_avg', 'weight_kg']

function HealthDataCard({ title }: { title: string }) {
  const [source, setSource] = useState<HealthSource>('garmin')

  const [garminRows,   setGarminRows]   = useState<GarminHealthRecord[]>([])
  const [ringconnRows, setRingconnRows] = useState<RingconnHealthRecord[]>([])
  const [appleRows,    setAppleRows]    = useState<AppleHealthRecord[]>([])

  const [garminLoading,   setGarminLoading]   = useState(true)
  const [ringconnLoading, setRingconnLoading] = useState(true)
  const [appleLoading,    setAppleLoading]    = useState(true)

  const [garminError,   setGarminError]   = useState(false)
  const [ringconnError, setRingconnError] = useState(false)
  const [appleError,    setAppleError]    = useState(false)

  useEffect(() => {
    let mounted = true
    getGarminHealth()
      .then((d) => { if (mounted) setGarminRows(d) })
      .catch(() => { if (mounted) setGarminError(true) })
      .finally(() => { if (mounted) setGarminLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    getRingconnHealth()
      .then((d) => { if (mounted) setRingconnRows(d) })
      .catch(() => { if (mounted) setRingconnError(true) })
      .finally(() => { if (mounted) setRingconnLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    let mounted = true
    getAppleHealth()
      .then((d) => { if (mounted) setAppleRows(d) })
      .catch(() => { if (mounted) setAppleError(true) })
      .finally(() => { if (mounted) setAppleLoading(false) })
    return () => { mounted = false }
  }, [])

  const isLoading  = source === 'garmin' ? garminLoading  : source === 'ringconn' ? ringconnLoading  : appleLoading
  const hasError   = source === 'garmin' ? garminError    : source === 'ringconn' ? ringconnError    : appleError
  const allRows    = source === 'garmin' ? garminRows     : source === 'ringconn' ? ringconnRows     : appleRows
  const cols       = source === 'garmin' ? GARMIN_COLS    : source === 'ringconn' ? RINGCONN_COLS    : APPLE_COLS
  const recentRows = [...allRows].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
  const lastSync   = allRows.length > 0 ? [...allRows].sort((a, b) => b.date.localeCompare(a.date))[0].date : null

  return (
    <article className="info-card section-page-card health-data-card">
      <h3>{title}</h3>

      <div className="experience-toggle" role="tablist" aria-label="Health data source">
        {(Object.keys(HEALTH_SOURCE_LABELS) as HealthSource[]).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={source === s}
            className={`experience-toggle-btn ${source === s ? 'active' : ''}`}
            onClick={() => setSource(s)}
          >
            {HEALTH_SOURCE_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="sheets-meta">Loading {HEALTH_SOURCE_LABELS[source]} data…</p>
      ) : hasError ? (
        <p className="sheets-meta">Could not load {HEALTH_SOURCE_LABELS[source]} data. Check that the sheet tab exists and the API key is configured.</p>
      ) : allRows.length === 0 ? (
        <p className="sheets-meta">No {HEALTH_SOURCE_LABELS[source]} data found. Run the ingestion script and check the sheet tab name matches exactly.</p>
      ) : (
        <>
          <p className="sheets-meta">
            {allRows.length} records · last synced {lastSync}
          </p>
          <div className="health-data-table-scroll">
            <table className="health-data-table">
              <thead>
                <tr>
                  {cols.map((col) => (
                    <th key={col}>{col.replace(/_/g, ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRows.map((row, i) => (
                  <tr key={i}>
                    {cols.map((col) => (
                      <td key={col}>{(row as Record<string, string>)[col] || '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
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
  const googleEmail = getGoogleTokenEmail(googleIdToken)

  if (path === '/mrpasionfruit/finances' && !canViewFinances(googleEmail)) {
    return <Navigate replace to="/mrpasionfruit" />
  }

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

        if (path === '/training/data' && card.title === 'Health Data') {
          return <HealthDataCard key={card.title} title={card.title} />
        }

        if (path === '/training/records' && card.title === 'Milestones') {
          return <MilestonesCard key={card.title} title={card.title} />
        }

        if (path === '/training/records' && card.title === 'Equipment') {
          return <EquipmentCard key={card.title} title={card.title} />
        }

        if (path === '/cooking/plan' && card.title === 'Meal Randomizer') {
          return <MealRandomizerCard key={card.title} title={card.title} />
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

        if (path === '/cooking/plan' && card.title === 'Grocery list') {
          const googleEmail = getGoogleTokenEmail(googleIdToken)
          const canWrite = profile === 'admin' && shouldUseAdminProfile(googleEmail)

          return (
            <GroceryListCard
              key={card.title}
              title={card.title}
              fallbackBody={card.body}
              canWrite={canWrite}
              idToken={googleIdToken}
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

function GoogleAutoSignIn({ onToken }: { onToken: (token: string) => void }) {
  useGoogleOneTapLogin({
    onSuccess: (credentialResponse) => {
      const token = credentialResponse.credential ?? ''
      if (token) onToken(token)
    },
    onError: () => {},
    auto_select: true,
    cancel_on_tap_outside: false,
  })
  return null
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
      const googleEmail = getGoogleTokenEmail(token)
      onSwitchProfile(shouldUseAdminProfile(googleEmail) ? 'admin' : 'guest')
      onGoogleTokenChange(token)
      navigate('/')
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
