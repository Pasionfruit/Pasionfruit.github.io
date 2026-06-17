import React, { type CSSProperties, type MouseEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ShoppingCart, SquareCheck, Utensils } from 'lucide-react'
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
import {
  Chart,
  CategoryScale,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Filler,
  Tooltip,
  TimeScale,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import './App.css'
import { sounds } from './sounds'
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
  setBackpackPacked,
  updateGroceryListItem,
  updateMealPlan,
  votePoll,
  getBudgetTargets,
  saveBudgetTarget,
  type BudgetTargetRecord,
  getTrips,
  createTrip,
  updateTrip,
  deleteTrip,
  getRecipes,
  getRecipeComponents,
  getRecipeSteps,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  createRecipeComponent,
  updateRecipeComponent,
  deleteRecipeComponent,
  createRecipeStep,
  updateRecipeStep,
  deleteRecipeStep,
  logMcServerStart,
} from './data/sheets/repositories'
import type {
  AppleHealthRecord,
  BackpackRecord,
  BucketListRecord,
  CountryRecord,
  CouponRecord,
  CurrentStudyRecord,
  EventRecord,
  FinanceTransactionRecord,
  GarminHealthRecord,
  GroceryListRecord,
  MealPlanRecord,
  PersonalTrainingRecord,
  PollRecord,
  RecipeComponentRecord,
  RecipeRecord,
  RecipeStepRecord,
  RingconnHealthRecord,
  TrainingRecord,
  TripRecord,
} from './data/sheets/types'
import { warmupAppsScript } from './data/sheets/client'
import { closeTask, createTask, getTasksOfTheDay, updateTask } from './data/todoist/repositories'
import type { TodoistTask } from './data/todoist/types'
import { importRecipeFromUrl, type ImportedIngredient } from './recipeImport'

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
      <Route element={<SiteLayout canViewFinances={canViewPrivateFinances} googleIdToken={googleIdToken} />}>
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
        <Route
          path="finances/points"
          element={canViewPrivateFinances ? <PointsConversionPage /> : <Navigate replace to="/finances" />}
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
        <Route
          path="gaming"
          element={<SectionPage sectionId="gaming" profile={profile} googleIdToken={googleIdToken} />}
        />
        <Route path="gaming/server" element={<GamingServerPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Route>
    </Routes>
    </>
  )
}

const EMAIL_INITIALS: Record<string, string> = {
  'pasionabe@gmail.com': 'AP',
  'pixielee1000@gmail.com': 'CL',
}

function SiteLayout({ canViewFinances, googleIdToken }: { canViewFinances: boolean; googleIdToken: string }) {
  const googleEmail = getGoogleTokenEmail(googleIdToken)
  const brandMark = EMAIL_INITIALS[googleEmail] ?? 'PF'
  const brandName = googleEmail.split('@')[0] || 'Pasionfruit'
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
    if (expandedSectionIds.includes(sectionId)) {
      sounds.sectionCollapse()
    } else {
      sounds.sectionExpand()
    }
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
          <span className="brand-mark">{brandMark}</span>
          <span className="brand-copy">
            <strong>{brandName}</strong>
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
  const [view, setView] = useState<'studying' | 'training' | 'todoist' | 'grocery' | 'meals'>(
    canViewOriginalTabs ? 'todoist' : 'studying',
  )
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [collapsedParentIds, setCollapsedParentIds] = useState<string[]>([])
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [addingSubtaskParentId, setAddingSubtaskParentId] = useState<string | null>(null)
  const [newSubtaskContent, setNewSubtaskContent] = useState('')

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

  const topLevelTasks = useMemo(() => rows.filter((r) => !r.parent_id), [rows])

  const subtasksByParentId = useMemo(() => {
    const map: Record<string, TodoistTask[]> = {}
    for (const r of rows) {
      if (r.parent_id) {
        if (!map[r.parent_id]) map[r.parent_id] = []
        map[r.parent_id].push(r)
      }
    }
    return map
  }, [rows])

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
      const topLevel = prev.filter((r) => !r.parent_id)
      const subtasks = prev.filter((r) => Boolean(r.parent_id))
      const next = [...topLevel]
      const [moved] = next.splice(from, 1)
      next.splice(to > from ? to - 1 : to, 0, moved)
      saveTaskOrder(next.map((t) => t.id))
      return [...next, ...subtasks]
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
      setIsAddingTask(false)
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
      setEditingTaskId(null)
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to update task')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleCreateSubTask(parentId: string) {
    if (isWriting || !todoistConfigured || !canEditTodoist) return
    const content = newSubtaskContent.trim()
    if (!content) {
      setWriteError('Subtask content is required.')
      return
    }
    setIsWriting(true)
    setWriteError('')
    try {
      await createTask(content, undefined, 1, parentId)
      setNewSubtaskContent('')
      setAddingSubtaskParentId(null)
      await loadTasks()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to create subtask')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleToggleTrainingWorkout(period: 'morning' | 'evening') {
    if (!canWrite || !googleIdToken || !todaysTrainingRecord || isWriting) return
    const isMorning = period === 'morning'
    const nextCompleted = isMorning ? !todaysTrainingRecord.completed_morning : !todaysTrainingRecord.completed_evening
    if (nextCompleted) sounds.studyWorkoutComplete()
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
    if (nextCompleted) sounds.studyWorkoutComplete()
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

    sounds.todoistComplete()
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
    setGroceryRows((prev) => prev.map((r) => ({ ...r, include: false, completed: false })))
    setIsWriting(true)
    setWriteError('')
    try {
      await Promise.all(
        included.map((row) =>
          updateGroceryListItem(googleIdToken, {
            originalItem: row.item,
            item: row.item,
            type: row.type,
            completed: false,
            include: false,
          }),
        ),
      )
    } catch (error) {
      setGroceryRows((prev) => prev.map((r) => {
        const wasIncluded = included.find((ir) => ir.item === r.item)
        return wasIncluded ? { ...r, include: true, completed: r.completed } : r
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
          {canEditAny && view === 'grocery' ? (
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
            {canViewOriginalTabs ? (
              <>
                <button
                  type="button"
                  role="tab"
                  aria-label="Grocery List"
                  aria-selected={view === 'grocery'}
                  className={`experience-toggle-btn ${view === 'grocery' ? 'active' : ''}`}
                  onClick={() => setView('grocery')}
                >
                  <ShoppingCart size={18} />
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-label="Meals"
                  aria-selected={view === 'meals'}
                  className={`experience-toggle-btn ${view === 'meals' ? 'active' : ''}`}
                  onClick={() => setView('meals')}
                >
                  <Utensils size={18} />
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-label="Todoist"
                  aria-selected={view === 'todoist'}
                  className={`experience-toggle-btn ${view === 'todoist' ? 'active' : ''}`}
                  onClick={() => setView('todoist')}
                >
                  <SquareCheck size={18} />
                </button>
              </>
            ) : null}
            <button
              type="button"
              role="tab"
              aria-label="Studying"
              aria-selected={view === 'studying'}
              className={`experience-toggle-btn ${view === 'studying' ? 'active' : ''}`}
              onClick={() => setView('studying')}
            >
              <BookOpen size={18} />
            </button>
            <button
              type="button"
              role="tab"
              aria-label="Training"
              aria-selected={view === 'training'}
              className={`experience-toggle-btn ${view === 'training' ? 'active' : ''}`}
              onClick={() => setView('training')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="miter" aria-hidden="true">
                <circle cx="12" cy="4" r="2.5"/>
                <polyline points="5,21 5,9 12,15 19,9 19,21"/>
              </svg>
            </button>
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

          {view === 'todoist' && todoistConfigured && (rows.length > 0 || (canEditTodoist && !isLoading)) ? (
            <div className="todoist-task-list" ref={taskListRef}>
              {topLevelTasks.map((row, topLevelIndex) => {
                const isTaskEditing = editingTaskId === row.id
                const taskSubtasks = subtasksByParentId[row.id] ?? []
                const isParentCollapsed = collapsedParentIds.includes(row.id)
                const draft = editedRows[row.id]
                return (
                  <React.Fragment key={`summary-${row.id}`}>
                    {draggingIndex !== null && dropInsertIndex === topLevelIndex && draggingIndex !== topLevelIndex && draggingIndex !== topLevelIndex - 1 ? (
                      <div className="todoist-drop-indicator" />
                    ) : null}
                    <div
                      className={[
                        'todoist-task-row',
                        row.is_completed ? 'is-completed' : '',
                        draggingIndex === topLevelIndex ? 'is-dragging' : '',
                        longPressingIndex === topLevelIndex ? 'is-long-pressing' : '',
                        isTaskEditing ? 'is-editing' : '',
                      ].filter(Boolean).join(' ')}
                      data-task-index={topLevelIndex}
                      data-priority={normalizePriority(row.priority)}
                      draggable={!isTaskEditing}
                      onDragStart={() => { if (!isTaskEditing) handleTaskDragStart(topLevelIndex) }}
                      onDragOver={(e) => handleTaskDragOver(e, topLevelIndex)}
                      onDrop={handleTaskDrop}
                      onDragEnd={handleTaskDragEnd}
                      onContextMenu={(e) => e.preventDefault()}
                      onTouchStart={(e) => {
                        if (isTaskEditing) return
                        const touch = e.touches[0]
                        touchStartPosRef.current = { x: touch.clientX, y: touch.clientY }
                        const rowEl = e.currentTarget as HTMLDivElement
                        setLongPressingIndex(topLevelIndex)
                        longPressTimerRef.current = setTimeout(() => {
                          longPressTimerRef.current = null
                          setLongPressingIndex(null)
                          draggingElRef.current = rowEl
                          draggingIndexRef.current = topLevelIndex
                          setDraggingIndex(topLevelIndex)
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
                      <div
                        className="todoist-task-content"
                        onClick={() => {
                          if (canEditTodoist && draggingIndex === null) {
                            setEditingTaskId(isTaskEditing ? null : row.id)
                            setAddingSubtaskParentId(null)
                          }
                        }}
                        role={canEditTodoist ? 'button' : undefined}
                        tabIndex={canEditTodoist ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (canEditTodoist && (e.key === 'Enter' || e.key === ' ')) {
                            setEditingTaskId(isTaskEditing ? null : row.id)
                          }
                        }}
                      >
                        <p className={row.is_completed ? 'todoist-task-done' : ''}>{row.content}</p>
                        {row.description && !isTaskEditing ? <p className="sheets-meta">{row.description}</p> : null}
                      </div>
                      {taskSubtasks.length > 0 ? (
                        <button
                          type="button"
                          className="todoist-subtask-toggle"
                          onClick={() => setCollapsedParentIds((prev) =>
                            prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]
                          )}
                          aria-label={isParentCollapsed ? 'Show subtasks' : 'Hide subtasks'}
                        >
                          {isParentCollapsed ? '▸' : '▾'}{taskSubtasks.length}
                        </button>
                      ) : null}
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
                    {isTaskEditing && canEditTodoist ? (
                      <div className="todoist-inline-edit">
                        <input
                          className="sheets-input"
                          type="text"
                          placeholder="Task name"
                          value={draft?.content ?? row.content}
                          onChange={(e) => setEditedRows((curr) => ({ ...curr, [row.id]: { ...curr[row.id], content: e.target.value } }))}
                          autoFocus
                          disabled={isWriting}
                          onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveTask(row) }}
                        />
                        <textarea
                          className="sheets-input todoist-inline-edit-desc"
                          placeholder="Description (optional)"
                          value={draft?.description ?? row.description ?? ''}
                          onChange={(e) => setEditedRows((curr) => ({ ...curr, [row.id]: { ...curr[row.id], description: e.target.value } }))}
                          rows={2}
                          disabled={isWriting}
                        />
                        <div className="todoist-inline-edit-row">
                          <input
                            className="sheets-input"
                            type="date"
                            value={draft?.dueDate ?? dateForInput(row.due?.date ?? row.due?.datetime ?? '')}
                            onChange={(e) => setEditedRows((curr) => ({ ...curr, [row.id]: { ...curr[row.id], dueDate: e.target.value } }))}
                            disabled={isWriting}
                          />
                          <select
                            className="sheets-input"
                            value={String(draft?.priority ?? normalizePriority(row.priority))}
                            onChange={(e) => setEditedRows((curr) => ({ ...curr, [row.id]: { ...curr[row.id], priority: normalizePriority(Number(e.target.value)) } }))}
                            disabled={isWriting}
                          >
                            <option value="1">P1</option>
                            <option value="2">P2</option>
                            <option value="3">P3</option>
                            <option value="4">P4</option>
                          </select>
                        </div>
                        <div className="todoist-inline-edit-actions">
                          <button type="button" className="secondary-action" onClick={() => void handleSaveTask(row)} disabled={isWriting}>Save</button>
                          <button type="button" className="secondary-action" onClick={() => setEditingTaskId(null)} disabled={isWriting}>Cancel</button>
                          {addingSubtaskParentId !== row.id ? (
                            <button type="button" className="secondary-action" onClick={() => setAddingSubtaskParentId(row.id)} disabled={isWriting}>
                              + Subtask
                            </button>
                          ) : null}
                        </div>
                        {addingSubtaskParentId === row.id ? (
                          <div className="todoist-subtask-add-form">
                            <input
                              className="sheets-input"
                              type="text"
                              placeholder="Subtask name"
                              value={newSubtaskContent}
                              onChange={(e) => setNewSubtaskContent(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateSubTask(row.id) }}
                              autoFocus
                              disabled={isWriting}
                            />
                            <div className="todoist-inline-edit-row">
                              <button type="button" className="secondary-action" onClick={() => void handleCreateSubTask(row.id)} disabled={isWriting || !newSubtaskContent.trim()}>Add</button>
                              <button type="button" className="secondary-action" onClick={() => { setAddingSubtaskParentId(null); setNewSubtaskContent('') }} disabled={isWriting}>Cancel</button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {!isParentCollapsed && taskSubtasks.length > 0 ? (
                      <ul className="todoist-subtask-list">
                        {taskSubtasks.map((subtask) => {
                          const isEditingSubtask = editingTaskId === subtask.id
                          const subtaskDraft = editedRows[subtask.id]
                          return (
                            <li key={subtask.id} className={`todoist-subtask-row${isEditingSubtask ? ' is-editing' : ''}`}>
                              {isEditingSubtask ? (
                                <div className="todoist-inline-edit todoist-subtask-inline-edit">
                                  <input
                                    className="sheets-input"
                                    type="text"
                                    placeholder="Subtask name"
                                    value={subtaskDraft?.content ?? subtask.content}
                                    onChange={(e) => setEditedRows((curr) => ({ ...curr, [subtask.id]: { ...curr[subtask.id], content: e.target.value } }))}
                                    autoFocus
                                    disabled={isWriting}
                                    onKeyDown={(e) => { if (e.key === 'Enter') void handleSaveTask(subtask) }}
                                  />
                                  <div className="todoist-inline-edit-row">
                                    <input
                                      className="sheets-input"
                                      type="date"
                                      value={subtaskDraft?.dueDate ?? dateForInput(subtask.due?.date ?? subtask.due?.datetime ?? '')}
                                      onChange={(e) => setEditedRows((curr) => ({ ...curr, [subtask.id]: { ...curr[subtask.id], dueDate: e.target.value } }))}
                                      disabled={isWriting}
                                    />
                                    <select
                                      className="sheets-input"
                                      value={String(subtaskDraft?.priority ?? normalizePriority(subtask.priority))}
                                      onChange={(e) => setEditedRows((curr) => ({ ...curr, [subtask.id]: { ...curr[subtask.id], priority: normalizePriority(Number(e.target.value)) } }))}
                                      disabled={isWriting}
                                    >
                                      <option value="1">P1</option>
                                      <option value="2">P2</option>
                                      <option value="3">P3</option>
                                      <option value="4">P4</option>
                                    </select>
                                  </div>
                                  <div className="todoist-inline-edit-actions">
                                    <button type="button" className="secondary-action" onClick={() => void handleSaveTask(subtask)} disabled={isWriting}>Save</button>
                                    <button type="button" className="secondary-action" onClick={() => setEditingTaskId(null)} disabled={isWriting}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div
                                    className="todoist-subtask-content"
                                    onClick={() => { if (canEditTodoist) setEditingTaskId(subtask.id) }}
                                    role={canEditTodoist ? 'button' : undefined}
                                    tabIndex={canEditTodoist ? 0 : undefined}
                                    onKeyDown={(e) => { if (canEditTodoist && (e.key === 'Enter' || e.key === ' ')) setEditingTaskId(subtask.id) }}
                                  >
                                    <span className={subtask.is_completed ? 'todoist-task-done' : ''}>{subtask.content}</span>
                                    {subtask.description ? <span className="sheets-meta todoist-subtask-desc">{subtask.description}</span> : null}
                                  </div>
                                  <button
                                    type="button"
                                    className="todoist-complete-btn"
                                    data-priority={normalizePriority(subtask.priority)}
                                    onClick={() => void handleCompleteTask(subtask)}
                                    disabled={isWriting || subtask.is_completed || !canEditTodoist}
                                    title={canEditTodoist ? 'Mark complete' : undefined}
                                    aria-label={`Complete: ${subtask.content}`}
                                  />
                                </>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </React.Fragment>
                )
              })}
              {draggingIndex !== null && dropInsertIndex === topLevelTasks.length && draggingIndex !== topLevelTasks.length - 1 ? (
                <div className="todoist-drop-indicator" />
              ) : null}
              <div
                className="todoist-drop-tail"
                onDragOver={(e) => { e.preventDefault(); setDropInsertIndex(topLevelTasks.length) }}
                onDrop={handleTaskDrop}
              />
              {canEditTodoist ? (
                isAddingTask ? (
                  <div className="todoist-add-form">
                    <input
                      className="sheets-input"
                      type="text"
                      placeholder="Task name"
                      value={newTaskContent}
                      onChange={(e) => setNewTaskContent(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void handleCreateTask() }}
                      autoFocus
                      disabled={isWriting}
                    />
                    <div className="todoist-inline-edit-row">
                      <input
                        className="sheets-input"
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        disabled={isWriting}
                      />
                      <select
                        className="sheets-input"
                        value={String(newTaskPriority)}
                        onChange={(e) => setNewTaskPriority(normalizePriority(Number(e.target.value)))}
                        disabled={isWriting}
                      >
                        <option value="1">P1</option>
                        <option value="2">P2</option>
                        <option value="3">P3</option>
                        <option value="4">P4</option>
                      </select>
                    </div>
                    <div className="todoist-inline-edit-actions">
                      <button type="button" className="secondary-action" onClick={() => void handleCreateTask()} disabled={isWriting}>Add task</button>
                      <button type="button" className="secondary-action" onClick={() => { setIsAddingTask(false); setNewTaskContent('') }} disabled={isWriting}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="todoist-add-task-btn" onClick={() => setIsAddingTask(true)}>
                    + Add task
                  </button>
                )
              ) : null}
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

          {view === 'todoist' && todoistConfigured && !isLoading && rows.length === 0 && !canEditTodoist && !writeError ? (
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

function PiggyBankIcon({ fillPct }: { fillPct: number }) {
  const clipped = Math.min(Math.max(fillPct, 0), 100)
  const fillY = 80 - (clipped / 100) * 60
  const id = 'piggy-clip'
  return (
    <svg className="trip-piggy" viewBox="0 0 100 100" width="80" height="80" aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <rect x="0" y={fillY} width="100" height="100" />
        </clipPath>
      </defs>
      {/* filled body */}
      <g clipPath={`url(#${id})`}>
        <ellipse cx="44" cy="58" rx="28" ry="24" fill="var(--page-accent)" opacity="0.35" />
        <circle cx="68" cy="46" rx="10" ry="10" r="10" fill="var(--page-accent)" opacity="0.35" />
      </g>
      {/* outline — always visible */}
      <ellipse cx="44" cy="58" rx="28" ry="24" fill="none" stroke="currentColor" strokeWidth="3" />
      {/* head */}
      <circle cx="68" cy="46" r="10" fill="none" stroke="currentColor" strokeWidth="3" />
      {/* ear */}
      <ellipse cx="62" cy="37" rx="4" ry="3" fill="none" stroke="currentColor" strokeWidth="2" />
      {/* snout */}
      <ellipse cx="77" cy="49" rx="4" ry="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="76" cy="49" r="1" fill="currentColor" />
      <circle cx="78" cy="49" r="1" fill="currentColor" />
      {/* eye */}
      <circle cx="70" cy="43" r="1.5" fill="currentColor" />
      {/* legs */}
      <line x1="28" y1="79" x2="24" y2="90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="38" y1="81" x2="36" y2="92" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="50" y1="81" x2="52" y2="92" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <line x1="60" y1="79" x2="64" y2="90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      {/* tail */}
      <path d="M16 55 Q8 48 12 42 Q16 36 12 30" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      {/* coin slot */}
      <rect x="36" y="32" width="12" height="3" rx="1.5" fill="currentColor" opacity="0.5" />
    </svg>
  )
}

const PIE_COLORS = ['#6366f1','#f59e0b','#22c55e','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6','#84cc16','#a78bfa','#fb923c']

function FinancePieChart({ data, title }: { data: { label: string; value: number }[]; title: string }) {
  const filtered = data.filter((d) => d.value > 0)
  const total = filtered.reduce((s, d) => s + d.value, 0)
  if (total === 0 || filtered.length === 0) return (
    <div className="finance-pie-chart">
      <p className="finance-pie-title">{title}</p>
      <p className="finance-pie-empty">No data</p>
    </div>
  )

  const SIZE = 110
  const cx = SIZE / 2
  const cy = SIZE / 2
  const r = SIZE / 2 - 5

  let angle = -Math.PI / 2
  const slices = filtered.map((d, i) => {
    const pct = d.value / total
    const end = angle + pct * 2 * Math.PI
    const x1 = cx + r * Math.cos(angle)
    const y1 = cy + r * Math.sin(angle)
    const x2 = cx + r * Math.cos(end)
    const y2 = cy + r * Math.sin(end)
    const largeArc = pct > 0.5 ? 1 : 0
    const path = filtered.length === 1
      ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
    const color = PIE_COLORS[i % PIE_COLORS.length]
    angle = end
    return { path, color, label: d.label, pct }
  })

  return (
    <div className="finance-pie-chart">
      <p className="finance-pie-title">{title}</p>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
      </svg>
      <ul className="finance-pie-legend">
        {slices.map((s, i) => (
          <li key={i} className="finance-pie-legend-item">
            <span className="finance-pie-dot" style={{ background: s.color }} />
            <span className="finance-pie-label">{s.label.charAt(0).toUpperCase() + s.label.slice(1)}</span>
            <span className="finance-pie-pct">{Math.round(s.pct * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FinancesHubCard({ idToken }: { idToken: string }) {
  type FinancesTab = 'dashboard' | 'calendar' | 'purchases' | 'trips'
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
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [tripRows, setTripRows] = useState<TripRecord[]>([])
  const [isLoadingTrips, setIsLoadingTrips] = useState(true)
  const [tripsError, setTripsError] = useState('')
  const [newTripName, setNewTripName] = useState('')
  const [newTripDate, setNewTripDate] = useState('')
  const [newTripAmount, setNewTripAmount] = useState('')
  const [isSavingTrip, setIsSavingTrip] = useState(false)
  const [savingTripId, setSavingTripId] = useState<string | null>(null)
  const [tripSavedDrafts, setTripSavedDrafts] = useState<Record<string, string>>({})
  const [mobileDashSection, setMobileDashSection] = useState<'Bills' | 'Expenses' | 'Income'>('Bills')

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

  async function loadTrips() {
    try {
      const data = await getTrips()
      setTripRows(data)
      setTripSavedDrafts(Object.fromEntries(data.map((t) => [t.trip_id, String(t.saved_amount)])))
      setTripsError('')
    } catch (error) {
      setTripRows([])
      setTripsError(error instanceof Error ? error.message : 'Unable to load trips')
    } finally {
      setIsLoadingTrips(false)
    }
  }

  useEffect(() => { void loadTrips() }, [])

  async function handleCreateTrip(event: React.FormEvent) {
    event.preventDefault()
    const name = newTripName.trim()
    const amount = parseFloat(newTripAmount)
    if (!name || !amount || amount <= 0) return
    setIsSavingTrip(true)
    setTripsError('')
    try {
      await createTrip(idToken, name, newTripDate, amount)
      setNewTripName('')
      setNewTripDate('')
      setNewTripAmount('')
      await loadTrips()
    } catch (error) {
      setTripsError(error instanceof Error ? error.message : 'Unable to create trip')
    } finally {
      setIsSavingTrip(false)
    }
  }

  async function handleUpdateSaved(trip: TripRecord) {
    const draft = tripSavedDrafts[trip.trip_id]
    const saved = parseFloat(draft ?? '')
    if (isNaN(saved) || saved < 0) return
    setSavingTripId(trip.trip_id)
    setTripsError('')
    try {
      await updateTrip(idToken, trip.trip_id, saved)
      await loadTrips()
    } catch (error) {
      setTripsError(error instanceof Error ? error.message : 'Unable to update trip')
    } finally {
      setSavingTripId(null)
    }
  }

  async function handleDeleteTrip(tripId: string) {
    setTripRows((prev) => prev.filter((t) => t.trip_id !== tripId))
    setTripsError('')
    try {
      await deleteTrip(idToken, tripId)
    } catch (error) {
      setTripsError(error instanceof Error ? error.message : 'Unable to delete trip')
      await loadTrips()
    }
  }

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
      <div className="section-card-header">
        <h3>Finances</h3>
        <button
          type="button"
          className="section-collapse-btn"
          aria-expanded={!isCollapsed}
          onClick={() => setIsCollapsed((v) => !v)}
        >
          {isCollapsed ? '▸' : '▾'}
        </button>
      </div>
      {!isCollapsed ? (
      <>
      <div className="experience-toggle" role="tablist" aria-label="Finances views">
        <button
          type="button"
          className={`experience-toggle-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'dashboard'}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={`experience-toggle-btn ${activeTab === 'calendar' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'calendar'}
          onClick={() => setActiveTab('calendar')}
        >
          Calendar
        </button>
        <button
          type="button"
          className={`experience-toggle-btn ${activeTab === 'purchases' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'purchases'}
          onClick={() => setActiveTab('purchases')}
        >
          Purchases
        </button>
        <button
          type="button"
          className={`experience-toggle-btn ${activeTab === 'trips' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'trips'}
          onClick={() => setActiveTab('trips')}
        >
          Trips
        </button>
      </div>

      {activeTab !== 'trips' ? (
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
      ) : null}

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
              <div className="finance-section-selector">
                {(['Bills', 'Expenses', 'Income'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={`finance-section-selector-btn${mobileDashSection === g ? ' active' : ''}`}
                    onClick={() => setMobileDashSection(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
              <div className="finance-pie-charts-row">
                {(['Bills', 'Expenses', 'Income'] as const).map((group) => {
                  const cats = group === 'Bills' ? BILL_CATEGORIES : group === 'Expenses' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES
                  return (
                    <div key={group} className={mobileDashSection !== group ? 'finance-group-mobile-hide' : undefined}>
                      <FinancePieChart
                        title={group}
                        data={cats.map((cat) => ({ label: cat, value: budgetTotals[cat] ?? 0 }))}
                      />
                    </div>
                  )
                })}
              </div>
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
                  <div key={group} className={`finance-budget-group finance-budget-section${mobileDashSection !== group ? ' finance-group-mobile-hide' : ''}`}>
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

      {activeTab === 'trips' ? (
        <div className="trips-panel">
          <form
            className="trip-add-form"
            onSubmit={(e) => { void handleCreateTrip(e) }}
          >
            <input
              className="sheets-input"
              type="text"
              placeholder="Trip name"
              value={newTripName}
              onChange={(e) => setNewTripName(e.target.value)}
              required
              disabled={isSavingTrip}
            />
            <input
              className="sheets-input"
              type="date"
              value={newTripDate}
              onChange={(e) => setNewTripDate(e.target.value)}
              disabled={isSavingTrip}
            />
            <input
              className="sheets-input"
              type="number"
              placeholder="Goal $"
              min="1"
              step="any"
              value={newTripAmount}
              onChange={(e) => setNewTripAmount(e.target.value)}
              required
              disabled={isSavingTrip}
            />
            <button type="submit" className="primary-action" disabled={isSavingTrip}>
              Add Trip
            </button>
          </form>

          {isLoadingTrips ? <p className="sheets-meta">Loading trips...</p> : null}
          {tripsError ? <p className="sheets-error">{tripsError}</p> : null}

          {!isLoadingTrips && tripRows.length === 0 ? (
            <p className="sheets-meta">No trips yet. Add one above!</p>
          ) : null}

          <div className="trips-list">
            {tripRows.map((trip) => {
              const pct = trip.target_amount > 0
                ? Math.min((trip.saved_amount / trip.target_amount) * 100, 100)
                : 0
              return (
                <div key={trip.trip_id} className="trip-card">
                  <div className="trip-card-header">
                    <strong className="trip-name">{trip.name}</strong>
                    {trip.target_date ? (
                      <span className="trip-date">{trip.target_date}</span>
                    ) : null}
                    <button
                      type="button"
                      className="section-collapse-btn trip-delete-btn"
                      aria-label={`Delete ${trip.name}`}
                      onClick={() => { void handleDeleteTrip(trip.trip_id) }}
                    >
                      ✕
                    </button>
                  </div>

                  <PiggyBankIcon fillPct={pct} />

                  <p className="trip-progress-label">
                    ${trip.saved_amount.toLocaleString()} / ${trip.target_amount.toLocaleString()} ({Math.round(pct)}%)
                  </p>

                  <div className="trip-save-row">
                    <input
                      className="sheets-input"
                      type="number"
                      min="0"
                      step="any"
                      value={tripSavedDrafts[trip.trip_id] ?? ''}
                      onChange={(e) => setTripSavedDrafts((prev) => ({ ...prev, [trip.trip_id]: e.target.value }))}
                      disabled={savingTripId === trip.trip_id}
                    />
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => { void handleUpdateSaved(trip) }}
                      disabled={savingTripId === trip.trip_id}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      </>
      ) : null}
    </article>
  )
}

const OREO_GANG_MEMBERS = ['Midnight', 'Pirouette', 'Inky'] as const
type OreoMember = typeof OREO_GANG_MEMBERS[number]

const OREO_GANG_DATA: Record<OreoMember, { image: string; description: string }> = {
  Midnight: {
    image: '/cats/midnight.jpg',
    description: '"mi-naɪt", mr. man \nclingy, likes to snuggle and play, will turn off computers and open doors for attention',
  },
  Pirouette: {
    image: '/cats/pirouette.jpg',
    description: '"pɪruˈɛ", chonk \nLoves to eat and receive ear rubs, very vocal in the kitchen',
  },
  Inky: {
    image: '/cats/inky.jpg',
    description: '"ɪŋki", stinky, crackhead \nShy but loves her laser pointer and feathers',
  },
}

function MakeRecipePopup({
  recipe,
  components,
  steps,
  onClose,
}: {
  recipe: RecipeRecord
  components: RecipeComponentRecord[]
  steps: RecipeStepRecord[]
  onClose: () => void
}) {
  const [checkedComponents, setCheckedComponents] = useState<Set<string>>(new Set())
  const [checkedSteps, setCheckedSteps] = useState<Set<string>>(new Set())

  function toggleComponent(id: string) {
    setCheckedComponents((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleStep(id: string) {
    setCheckedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const equipment = components.filter((c) => c.type.toLowerCase() === 'equipment')
  const ingredients = components.filter((c) => c.type.toLowerCase() !== 'equipment')
  const sortedSteps = [...steps].sort((a, b) => a.step_number - b.step_number)

  return (
    <>
      <div className="recipe-popup-header">
        <h2 className="recipe-popup-title">{recipe.recipe_name}</h2>
        <button type="button" className="finance-dialog-close" onClick={onClose}>
          Close
        </button>
      </div>

      <p className="recipe-popup-meta">
        {recipe.category ? <span>{recipe.category}</span> : null}
        {recipe.cook_time ? <span>⏱ {recipe.cook_time}</span> : null}
        {recipe.servings ? <span>🍽 {recipe.servings} servings</span> : null}
        {recipe.calories ? <span>🔥 {recipe.calories} cal</span> : null}
      </p>

      {(recipe.video_link || recipe.website_link) ? (
        <div className="recipe-popup-links">
          {recipe.video_link ? (
            <a href={recipe.video_link} target="_blank" rel="noopener noreferrer" className="recipe-popup-link">
              ▶ Video
            </a>
          ) : null}
          {recipe.website_link ? (
            <a href={recipe.website_link} target="_blank" rel="noopener noreferrer" className="recipe-popup-link">
              🔗 Recipe source
            </a>
          ) : null}
        </div>
      ) : null}

      {equipment.length > 0 ? (
        <>
          <p className="recipe-popup-section-heading">Equipment</p>
          <ul className="recipe-checklist">
            {equipment.map((c) => (
              <li
                key={c.component_id}
                className={`recipe-checklist-item ${checkedComponents.has(c.component_id) ? 'checked' : ''}`}
                onClick={() => toggleComponent(c.component_id)}
              >
                <input type="checkbox" checked={checkedComponents.has(c.component_id)} onChange={() => toggleComponent(c.component_id)} />
                <span>{c.name}{c.note ? ` — ${c.note}` : ''}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {ingredients.length > 0 ? (
        <>
          <p className="recipe-popup-section-heading">Ingredients</p>
          <ul className="recipe-checklist">
            {ingredients.map((c) => (
              <li
                key={c.component_id}
                className={`recipe-checklist-item ${checkedComponents.has(c.component_id) ? 'checked' : ''}`}
                onClick={() => toggleComponent(c.component_id)}
              >
                <input type="checkbox" checked={checkedComponents.has(c.component_id)} onChange={() => toggleComponent(c.component_id)} />
                <span>
                  {[c.quantity, c.unit, c.name].filter(Boolean).join(' ')}
                  {c.note ? ` (${c.note})` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {sortedSteps.length > 0 ? (
        <>
          <p className="recipe-popup-section-heading">Instructions</p>
          <ul className="recipe-checklist">
            {sortedSteps.map((s) => (
              <li
                key={s.step_id}
                className={`recipe-checklist-item ${checkedSteps.has(s.step_id) ? 'checked' : ''}`}
                onClick={() => toggleStep(s.step_id)}
              >
                <input type="checkbox" checked={checkedSteps.has(s.step_id)} onChange={() => toggleStep(s.step_id)} />
                <span className="recipe-step-number">{s.step_number}.</span>
                <span>{s.instruction}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  )
}

function parseCookMinutes(cookTime: string): number | null {
  if (!cookTime) return null
  const t = cookTime.toLowerCase()
  let total = 0
  const hrMatch = t.match(/(\d+(?:\.\d+)?)\s*h(?:r|our)?s?/)
  const minMatch = t.match(/(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?/)
  if (hrMatch) total += parseFloat(hrMatch[1]) * 60
  if (minMatch) total += parseFloat(minMatch[1])
  return total > 0 ? total : null
}

function RecipesCard({
  title,
  canWrite,
  idToken,
}: {
  title: string
  canWrite: boolean
  idToken: string
}) {
  const [recipes, setRecipes] = useState<RecipeRecord[]>([])
  const [components, setComponents] = useState<RecipeComponentRecord[]>([])
  const [steps, setSteps] = useState<RecipeStepRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [makingRecipe, setMakingRecipe] = useState<RecipeRecord | null>(null)
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null)

  // New recipe draft
  const [draftName, setDraftName] = useState('')
  const [draftCategory, setDraftCategory] = useState('')
  const [draftCalories, setDraftCalories] = useState('')
  const [draftServings, setDraftServings] = useState('')
  const [draftVideoLink, setDraftVideoLink] = useState('')
  const [draftWebsiteLink, setDraftWebsiteLink] = useState('')
  const [draftCookTime, setDraftCookTime] = useState('')

  // Edit existing recipe draft
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<RecipeRecord>>>({})

  // New component draft
  const [draftCompType, setDraftCompType] = useState('ingredient')
  const [draftCompName, setDraftCompName] = useState('')
  const [draftCompQty, setDraftCompQty] = useState('')
  const [draftCompUnit, setDraftCompUnit] = useState('')
  const [draftCompNote, setDraftCompNote] = useState('')

  // New step draft
  const [draftStepInstruction, setDraftStepInstruction] = useState('')

  const [editingCompId, setEditingCompId] = useState<string | null>(null)
  const [editCompDraft, setEditCompDraft] = useState<Partial<RecipeComponentRecord>>({})
  const [editingStepId, setEditingStepId] = useState<string | null>(null)
  const [editStepDraft, setEditStepDraft] = useState('')

  const compNameInputRef = useRef<HTMLInputElement>(null)
  const stepInputRef = useRef<HTMLInputElement>(null)

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [mobileEditRecipeId, setMobileEditRecipeId] = useState<string | null>(null)

  // Import state
  const [isImporting, setIsImporting] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importStatus, setImportStatus] = useState<'idle' | 'fetching' | 'preview' | 'error'>('idle')
  const [importError, setImportError] = useState('')
  const [importPlatform, setImportPlatform] = useState<'tiktok' | 'instagram' | 'web'>('web')
  const [importAutoExtracted, setImportAutoExtracted] = useState(false)
  const [importName, setImportName] = useState('')
  const [importCategory, setImportCategory] = useState('')
  const [importCalories, setImportCalories] = useState('')
  const [importServings, setImportServings] = useState('')
  const [importVideoLink, setImportVideoLink] = useState('')
  const [importWebsiteLink, setImportWebsiteLink] = useState('')
  const [importCookTime, setImportCookTime] = useState('')
  const [importIngredients, setImportIngredients] = useState<ImportedIngredient[]>([])
  const [importSteps, setImportSteps] = useState<string[]>([])

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [durationFilter, setDurationFilter] = useState('')
  const [equipmentFilter, setEquipmentFilter] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const PAGE_SIZE = 6

  const equipmentOptions = useMemo(() => {
    const names = components
      .filter((c) => c.type.toLowerCase() === 'equipment')
      .map((c) => c.name.trim())
      .filter(Boolean)
    return [...new Set(names)].sort()
  }, [components])

  const filteredRecipes = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return recipes.filter((recipe) => {
      if (q && !recipe.recipe_name.toLowerCase().includes(q)) return false
      if (durationFilter) {
        const mins = parseCookMinutes(recipe.cook_time)
        if (durationFilter === 'under-30' && (mins === null || mins >= 30)) return false
        if (durationFilter === '30-60' && (mins === null || mins < 30 || mins > 60)) return false
        if (durationFilter === 'over-60' && (mins === null || mins <= 60)) return false
      }
      if (equipmentFilter) {
        const recipeEquipment = components
          .filter((c) => c.recipe_id === recipe.recipe_id && c.type.toLowerCase() === 'equipment')
          .map((c) => c.name.trim())
        if (!recipeEquipment.includes(equipmentFilter)) return false
      }
      return true
    })
  }, [recipes, components, searchQuery, durationFilter, equipmentFilter])

  useEffect(() => { setCurrentPage(1) }, [searchQuery, durationFilter, equipmentFilter, isEditing, viewMode])

  const totalPages = Math.max(1, Math.ceil(filteredRecipes.length / PAGE_SIZE))
  const pagedRecipes = filteredRecipes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  async function loadAll() {
    try {
      const [r, c, s] = await Promise.all([getRecipes(), getRecipeComponents(), getRecipeSteps()])
      setRecipes(r)
      setComponents(c)
      setSteps(s)
      setWriteError('')
    } catch {
      setRecipes([])
      setComponents([])
      setSteps([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    const next: Record<string, Partial<RecipeRecord>> = {}
    recipes.forEach((r) => { next[r.recipe_id] = { ...r } })
    setEditDrafts(next)
  }, [recipes])

  async function handleCreateRecipe() {
    if (!idToken || isWriting || !draftName.trim()) return
    setIsWriting(true)
    setWriteError('')
    try {
      await createRecipe(idToken, {
        recipeName: draftName.trim(),
        category: draftCategory.trim(),
        calories: draftCalories.trim(),
        servings: draftServings.trim(),
        videoLink: draftVideoLink.trim(),
        websiteLink: draftWebsiteLink.trim(),
        cookTime: draftCookTime.trim(),
      })
      setDraftName(''); setDraftCategory(''); setDraftCalories(''); setDraftServings('')
      setDraftVideoLink(''); setDraftWebsiteLink(''); setDraftCookTime('')
      await loadAll()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to create recipe')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleUpdateRecipe(recipe: RecipeRecord) {
    if (!idToken || isWriting) return
    const draft = editDrafts[recipe.recipe_id]
    if (!draft) return
    setIsWriting(true)
    setWriteError('')
    try {
      await updateRecipe(idToken, recipe.recipe_id, {
        recipeName: String(draft.recipe_name ?? recipe.recipe_name).trim(),
        category: String(draft.category ?? recipe.category).trim(),
        calories: String(draft.calories ?? recipe.calories).trim(),
        servings: String(draft.servings ?? recipe.servings).trim(),
        videoLink: String(draft.video_link ?? recipe.video_link).trim(),
        websiteLink: String(draft.website_link ?? recipe.website_link).trim(),
        cookTime: String(draft.cook_time ?? recipe.cook_time).trim(),
      })
      await loadAll()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to update recipe')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleDeleteRecipe(recipeId: string) {
    if (!idToken || isWriting) return
    setIsWriting(true)
    setWriteError('')
    try {
      await deleteRecipe(idToken, recipeId)
      if (editingRecipeId === recipeId) setEditingRecipeId(null)
      await loadAll()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to delete recipe')
    } finally {
      setIsWriting(false)
    }
  }

  function resetImportState() {
    setImportUrl('')
    setImportStatus('idle')
    setImportError('')
    setImportName('')
    setImportCategory('')
    setImportCalories('')
    setImportServings('')
    setImportVideoLink('')
    setImportWebsiteLink('')
    setImportCookTime('')
    setImportIngredients([])
    setImportSteps([])
  }

  async function handleFetchRecipe() {
    const url = importUrl.trim()
    if (!url) return
    setImportStatus('fetching')
    setImportError('')
    try {
      const draft = await importRecipeFromUrl(url)
      setImportPlatform(draft.source_platform)
      setImportAutoExtracted(draft.auto_extracted)
      setImportName(draft.recipe_name)
      setImportCategory(draft.category)
      setImportCalories(draft.calories)
      setImportServings(draft.servings)
      setImportVideoLink(draft.video_link)
      setImportWebsiteLink(draft.website_link)
      setImportCookTime(draft.cook_time)
      setImportIngredients(draft.ingredients.length > 0 ? draft.ingredients : [{ name: '', quantity: '', unit: '', note: '' }])
      setImportSteps(draft.steps.length > 0 ? draft.steps : [''])
      setImportStatus('preview')
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Failed to fetch recipe')
      setImportStatus('error')
    }
  }

  async function handleImportConfirm() {
    if (!idToken || isWriting || !importName.trim()) return
    setIsWriting(true)
    setWriteError('')
    try {
      const previousIds = new Set(recipes.map((r) => r.recipe_id))
      await createRecipe(idToken, {
        recipeName: importName.trim(),
        category: importCategory.trim(),
        calories: importCalories.trim(),
        servings: importServings.trim(),
        videoLink: importVideoLink.trim(),
        websiteLink: importWebsiteLink.trim(),
        cookTime: importCookTime.trim(),
      })
      const freshRecipes = await getRecipes()
      const newRecipe = freshRecipes.find((r) => !previousIds.has(r.recipe_id))
      if (newRecipe) {
        const validIngredients = importIngredients.filter((i) => i.name.trim())
        for (const ing of validIngredients) {
          await createRecipeComponent(idToken, {
            recipeId: newRecipe.recipe_id,
            type: 'ingredient',
            name: ing.name.trim(),
            quantity: ing.quantity.trim(),
            unit: ing.unit.trim(),
            note: ing.note.trim(),
          })
        }
        const validSteps = importSteps.filter((s) => s.trim())
        for (let i = 0; i < validSteps.length; i++) {
          await createRecipeStep(idToken, {
            recipeId: newRecipe.recipe_id,
            stepNumber: i + 1,
            instruction: validSteps[i].trim(),
          })
        }
      }
      await loadAll()
      setIsImporting(false)
      resetImportState()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Failed to import recipe')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleAddComponent(recipeId: string) {
    if (!idToken || isWriting || !draftCompName.trim()) return
    setIsWriting(true)
    setWriteError('')
    try {
      await createRecipeComponent(idToken, {
        recipeId,
        type: draftCompType,
        name: draftCompName.trim(),
        quantity: draftCompQty.trim(),
        unit: draftCompUnit.trim(),
        note: draftCompNote.trim(),
      })
      setDraftCompName(''); setDraftCompQty(''); setDraftCompUnit(''); setDraftCompNote('')
      await loadAll()
      compNameInputRef.current?.focus()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to add component')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleUpdateComponent(c: RecipeComponentRecord) {
    if (!idToken || isWriting) return
    setIsWriting(true)
    setWriteError('')
    try {
      await updateRecipeComponent(idToken, c.component_id, {
        type: c.type,
        name: String(editCompDraft.name ?? c.name).trim(),
        quantity: String(editCompDraft.quantity ?? c.quantity).trim(),
        unit: String(editCompDraft.unit ?? c.unit).trim(),
        note: String(editCompDraft.note ?? c.note).trim(),
      })
      setEditingCompId(null)
      setEditCompDraft({})
      await loadAll()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to update component')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleDeleteComponent(componentId: string) {
    if (!idToken || isWriting) return
    setIsWriting(true)
    setWriteError('')
    try {
      await deleteRecipeComponent(idToken, componentId)
      await loadAll()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to delete component')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleUpdateStep(s: RecipeStepRecord) {
    if (!idToken || isWriting || !editStepDraft.trim()) return
    setIsWriting(true)
    setWriteError('')
    try {
      await updateRecipeStep(idToken, s.step_id, {
        stepNumber: s.step_number,
        instruction: editStepDraft.trim(),
      })
      setEditingStepId(null)
      setEditStepDraft('')
      await loadAll()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to update step')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleAddStep(recipeId: string) {
    if (!idToken || isWriting || !draftStepInstruction.trim()) return
    const existingSteps = steps.filter((s) => s.recipe_id === recipeId)
    const nextStepNumber = existingSteps.length > 0 ? Math.max(...existingSteps.map((s) => s.step_number)) + 1 : 1
    setIsWriting(true)
    setWriteError('')
    try {
      await createRecipeStep(idToken, {
        recipeId,
        stepNumber: nextStepNumber,
        instruction: draftStepInstruction.trim(),
      })
      setDraftStepInstruction('')
      await loadAll()
      stepInputRef.current?.focus()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to add step')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleDeleteStep(stepId: string) {
    if (!idToken || isWriting) return
    setIsWriting(true)
    setWriteError('')
    try {
      await deleteRecipeStep(idToken, stepId)
      await loadAll()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to delete step')
    } finally {
      setIsWriting(false)
    }
  }

  const managedRecipe = editingRecipeId ? recipes.find((r) => r.recipe_id === editingRecipeId) ?? null : null
  const managedComponents = editingRecipeId ? components.filter((c) => c.recipe_id === editingRecipeId) : []
  const managedSteps = editingRecipeId ? [...steps.filter((s) => s.recipe_id === editingRecipeId)].sort((a, b) => a.step_number - b.step_number) : []

  return (
    <article className="info-card section-page-card sheets-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          <button
            type="button"
            className={`section-edit-btn${viewMode === 'list' ? ' active' : ''}`}
            aria-pressed={viewMode === 'list'}
            onClick={() => setViewMode((v) => v === 'grid' ? 'list' : 'grid')}
            title={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
          >
            {viewMode === 'grid' ? '☰' : '⊞'}
          </button>
          {canWrite ? (
            <>
              <button
                type="button"
                className={`section-edit-btn ${isImporting ? 'active' : ''}`}
                aria-pressed={isImporting}
                onClick={() => { setIsImporting((v) => !v); if (isImporting) resetImportState() }}
                title="Import recipe from URL"
              >
                ⬇
              </button>
              <button
                type="button"
                className={`section-edit-btn ${isEditing ? 'active' : ''}`}
                aria-pressed={isEditing}
                onClick={() => { setIsEditing((v) => !v); setEditingRecipeId(null) }}
                title="Edit recipes"
              >
                ✎
              </button>
            </>
          ) : null}
        </div>
      </div>

      {isImporting && canWrite ? (
        <div className="recipe-import-panel">
          <div className="recipe-import-url-row">
            <input
              className="sheets-input recipe-import-url-input"
              type="url"
              placeholder="Paste a TikTok, Instagram, or recipe URL…"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleFetchRecipe() }}
              disabled={importStatus === 'fetching'}
              autoFocus
            />
            <button
              type="button"
              className="secondary-action"
              onClick={() => void handleFetchRecipe()}
              disabled={!importUrl.trim() || importStatus === 'fetching'}
            >
              {importStatus === 'fetching' ? 'Fetching…' : 'Fetch'}
            </button>
          </div>

          {importStatus === 'error' ? (
            <p className="sheets-error">{importError} — fill in the details manually or try a different URL.</p>
          ) : null}

          {importStatus === 'preview' || importStatus === 'error' ? (
            <div className="recipe-import-preview">
              {importStatus === 'preview' && importPlatform !== 'web' ? (
                <p className="sheets-meta recipe-import-notice">
                  {importPlatform === 'tiktok' ? '🎵 TikTok' : '📸 Instagram'} link detected — auto-extraction isn't possible. The link has been saved; please fill in the recipe details below.
                </p>
              ) : importStatus === 'preview' && importAutoExtracted ? (
                <p className="sheets-meta recipe-import-notice">
                  ✓ Recipe extracted from {(() => { try { return new URL(importUrl).hostname } catch { return importUrl } })()} — review and confirm below.
                </p>
              ) : null}

              <div className="recipe-card-edit-form">
                <div className="recipe-card-edit-field recipe-card-edit-field--full">
                  <span className="recipe-card-edit-label">Name *</span>
                  <input className="sheets-input" type="text" value={importName} onChange={(e) => setImportName(e.target.value)} disabled={isWriting} placeholder="Recipe name" />
                </div>
                <div className="recipe-card-edit-field">
                  <span className="recipe-card-edit-label">Category</span>
                  <input className="sheets-input" type="text" value={importCategory} onChange={(e) => setImportCategory(e.target.value)} disabled={isWriting} placeholder="e.g. Italian" />
                </div>
                <div className="recipe-card-edit-field">
                  <span className="recipe-card-edit-label">Cook time</span>
                  <input className="sheets-input" type="text" value={importCookTime} onChange={(e) => setImportCookTime(e.target.value)} disabled={isWriting} placeholder="e.g. 30 min" />
                </div>
                <div className="recipe-card-edit-field">
                  <span className="recipe-card-edit-label">Calories</span>
                  <input className="sheets-input" type="text" value={importCalories} onChange={(e) => setImportCalories(e.target.value)} disabled={isWriting} placeholder="per serving" />
                </div>
                <div className="recipe-card-edit-field">
                  <span className="recipe-card-edit-label">Servings</span>
                  <input className="sheets-input" type="text" value={importServings} onChange={(e) => setImportServings(e.target.value)} disabled={isWriting} />
                </div>
                <div className="recipe-card-edit-field">
                  <span className="recipe-card-edit-label">Video link</span>
                  <input className="sheets-input" type="text" value={importVideoLink} onChange={(e) => setImportVideoLink(e.target.value)} disabled={isWriting} />
                </div>
                <div className="recipe-card-edit-field">
                  <span className="recipe-card-edit-label">Website link</span>
                  <input className="sheets-input" type="text" value={importWebsiteLink} onChange={(e) => setImportWebsiteLink(e.target.value)} disabled={isWriting} />
                </div>
              </div>

              <div className="recipe-import-section">
                <p className="recipe-card-edit-label">Ingredients</p>
                <ul className="recipe-import-ingredient-list">
                  {importIngredients.map((ing, idx) => (
                    <li key={idx} className="recipe-import-ingredient-row">
                      <input
                        className="sheets-input recipe-import-ing-qty"
                        type="text"
                        placeholder="Qty"
                        value={ing.quantity}
                        onChange={(e) => setImportIngredients((prev) => prev.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                        disabled={isWriting}
                      />
                      <input
                        className="sheets-input recipe-import-ing-unit"
                        type="text"
                        placeholder="Unit"
                        value={ing.unit}
                        onChange={(e) => setImportIngredients((prev) => prev.map((x, i) => i === idx ? { ...x, unit: e.target.value } : x))}
                        disabled={isWriting}
                      />
                      <input
                        className="sheets-input recipe-import-ing-name"
                        type="text"
                        placeholder="Ingredient name"
                        value={ing.name}
                        onChange={(e) => setImportIngredients((prev) => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                        disabled={isWriting}
                      />
                      <button
                        type="button"
                        className="recipe-comp-edit-btn"
                        onClick={() => setImportIngredients((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={isWriting}
                        aria-label="Remove ingredient"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="secondary-action recipe-import-add-btn"
                  onClick={() => setImportIngredients((prev) => [...prev, { name: '', quantity: '', unit: '', note: '' }])}
                  disabled={isWriting}
                >
                  + Add ingredient
                </button>
              </div>

              <div className="recipe-import-section">
                <p className="recipe-card-edit-label">Steps</p>
                <ol className="recipe-import-step-list">
                  {importSteps.map((step, idx) => (
                    <li key={idx} className="recipe-import-step-row">
                      <span className="recipe-import-step-num">{idx + 1}.</span>
                      <input
                        className="sheets-input recipe-import-step-input"
                        type="text"
                        placeholder={`Step ${idx + 1}`}
                        value={step}
                        onChange={(e) => setImportSteps((prev) => prev.map((s, i) => i === idx ? e.target.value : s))}
                        disabled={isWriting}
                      />
                      <button
                        type="button"
                        className="recipe-comp-edit-btn"
                        onClick={() => setImportSteps((prev) => prev.filter((_, i) => i !== idx))}
                        disabled={isWriting}
                        aria-label="Remove step"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  className="secondary-action recipe-import-add-btn"
                  onClick={() => setImportSteps((prev) => [...prev, ''])}
                  disabled={isWriting}
                >
                  + Add step
                </button>
              </div>

              <div className="recipe-import-actions">
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => void handleImportConfirm()}
                  disabled={isWriting || !importName.trim()}
                >
                  {isWriting ? 'Saving…' : 'Confirm & Save Recipe'}
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => { setIsImporting(false); resetImportState() }}
                  disabled={isWriting}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {isLoading ? <p className="sheets-meta">Loading recipes...</p> : null}

      {!isLoading && recipes.length === 0 ? <p className="sheets-meta">No recipes yet.</p> : null}
      {!isLoading && recipes.length > 0 && filteredRecipes.length === 0 ? <p className="sheets-meta">No recipes match the current filters.</p> : null}

      {!canWrite && !idToken ? null : null}

      {isEditing && canWrite ? (
        <div className="recipe-add-form">
          <p className="sheets-meta">New recipe</p>
          <div className="recipe-card-edit-form">
            <div className="recipe-card-edit-field recipe-card-edit-field--full">
              <span className="recipe-card-edit-label">Name *</span>
              <input className="sheets-input" type="text" value={draftName} onChange={(e) => setDraftName(e.target.value)} disabled={isWriting} />
            </div>
            <div className="recipe-card-edit-field">
              <span className="recipe-card-edit-label">Category</span>
              <input className="sheets-input" type="text" value={draftCategory} onChange={(e) => setDraftCategory(e.target.value)} disabled={isWriting} />
            </div>
            <div className="recipe-card-edit-field">
              <span className="recipe-card-edit-label">Cook time</span>
              <input className="sheets-input" type="text" value={draftCookTime} onChange={(e) => setDraftCookTime(e.target.value)} disabled={isWriting} />
            </div>
            <div className="recipe-card-edit-field">
              <span className="recipe-card-edit-label">Calories</span>
              <input className="sheets-input" type="text" value={draftCalories} onChange={(e) => setDraftCalories(e.target.value)} disabled={isWriting} />
            </div>
            <div className="recipe-card-edit-field">
              <span className="recipe-card-edit-label">Servings</span>
              <input className="sheets-input" type="text" value={draftServings} onChange={(e) => setDraftServings(e.target.value)} disabled={isWriting} />
            </div>
            <div className="recipe-card-edit-field">
              <span className="recipe-card-edit-label">Video link</span>
              <input className="sheets-input" type="text" value={draftVideoLink} onChange={(e) => setDraftVideoLink(e.target.value)} disabled={isWriting} />
            </div>
            <div className="recipe-card-edit-field">
              <span className="recipe-card-edit-label">Website link</span>
              <input className="sheets-input" type="text" value={draftWebsiteLink} onChange={(e) => setDraftWebsiteLink(e.target.value)} disabled={isWriting} />
            </div>
          </div>
          <button type="button" className="secondary-action" onClick={() => void handleCreateRecipe()} disabled={!idToken || isWriting || !draftName.trim()}>
            {isWriting ? 'Saving…' : 'Add recipe'}
          </button>
        </div>
      ) : null}

      {recipes.length > 0 ? (
        <div className="recipe-filter-bar">
          <input
            className="sheets-input recipe-filter-search"
            type="search"
            placeholder="Search by title…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select
            className="sheets-input"
            value={durationFilter}
            onChange={(e) => setDurationFilter(e.target.value)}
          >
            <option value="">All durations</option>
            <option value="under-30">Under 30 min</option>
            <option value="30-60">30 – 60 min</option>
            <option value="over-60">Over 60 min</option>
          </select>
          <select
            className="sheets-input"
            value={equipmentFilter}
            onChange={(e) => setEquipmentFilter(e.target.value)}
          >
            <option value="">All equipment</option>
            {equipmentOptions.map((eq) => (
              <option key={eq} value={eq}>{eq}</option>
            ))}
          </select>
        </div>
      ) : null}

      {recipes.length > 0 && viewMode === 'list' && !isEditing ? (
        <ul className="recipe-list-view">
          {pagedRecipes.map((recipe) => (
            <li key={recipe.recipe_id} className="recipe-list-item">
              <span className="recipe-list-name">{recipe.recipe_name}</span>
              <span className="recipe-list-meta">
                {[recipe.category, recipe.cook_time ? `⏱ ${recipe.cook_time}` : null, recipe.calories ? `🔥 ${recipe.calories} cal` : null]
                  .filter(Boolean).join(' · ')}
              </span>
              <button type="button" className="secondary-action recipe-list-make-btn" onClick={() => setMakingRecipe(recipe)}>Make</button>
            </li>
          ))}
        </ul>
      ) : null}

      {isEditing && canWrite && filteredRecipes.length > 0 ? (
        <div className="sheets-table-shell recipe-edit-table-shell">
          <table className="sheets-table recipe-edit-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Cook time</th>
                <th>Calories</th>
                <th>Servings</th>
                <th>Video</th>
                <th>Website</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagedRecipes.map((recipe) => {
                const draft = editDrafts[recipe.recipe_id] ?? recipe
                return (
                  <tr key={recipe.recipe_id}>
                    <td><input className="sheets-input sheets-table-input" type="text" value={String(draft.recipe_name ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], recipe_name: e.target.value } }))} disabled={isWriting} /></td>
                    <td><input className="sheets-input sheets-table-input" type="text" value={String(draft.category ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], category: e.target.value } }))} disabled={isWriting} /></td>
                    <td><input className="sheets-input sheets-table-input" type="text" value={String(draft.cook_time ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], cook_time: e.target.value } }))} disabled={isWriting} /></td>
                    <td><input className="sheets-input sheets-table-input" type="text" value={String(draft.calories ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], calories: e.target.value } }))} disabled={isWriting} /></td>
                    <td><input className="sheets-input sheets-table-input" type="text" value={String(draft.servings ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], servings: e.target.value } }))} disabled={isWriting} /></td>
                    <td><input className="sheets-input sheets-table-input" type="text" value={String(draft.video_link ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], video_link: e.target.value } }))} disabled={isWriting} /></td>
                    <td><input className="sheets-input sheets-table-input" type="text" value={String(draft.website_link ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], website_link: e.target.value } }))} disabled={isWriting} /></td>
                    <td className="recipe-edit-table-actions">
                      <button type="button" className="secondary-action" onClick={() => setEditingRecipeId(editingRecipeId === recipe.recipe_id ? null : recipe.recipe_id)} disabled={isWriting} title="Ingredients & Steps">⚙</button>
                      <button type="button" className="secondary-action recipe-save-btn" onClick={() => void handleUpdateRecipe(recipe)} disabled={!idToken || isWriting} title="Save">✓</button>
                      <button type="button" className="secondary-action recipe-delete-btn" onClick={() => void handleDeleteRecipe(recipe.recipe_id)} disabled={!idToken || isWriting} title="Delete">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {isEditing && canWrite && filteredRecipes.length > 0 ? (
        <ul className="recipe-edit-mobile-list">
          {pagedRecipes.map((recipe) => {
            const draft = editDrafts[recipe.recipe_id] ?? recipe
            const expanded = mobileEditRecipeId === recipe.recipe_id
            return (
              <li key={recipe.recipe_id} className="recipe-edit-mobile-item">
                <button
                  type="button"
                  className="recipe-edit-mobile-row"
                  onClick={() => setMobileEditRecipeId(expanded ? null : recipe.recipe_id)}
                >
                  <span className="recipe-edit-mobile-name">{recipe.recipe_name}</span>
                  <span className="recipe-edit-mobile-meta">{[recipe.category, recipe.cook_time].filter(Boolean).join(' · ')}</span>
                  <span className="recipe-edit-mobile-chevron">{expanded ? '▾' : '▸'}</span>
                </button>
                {expanded ? (
                  <div className="recipe-edit-mobile-form">
                    <div className="recipe-card-edit-form">
                      <div className="recipe-card-edit-field recipe-card-edit-field--full">
                        <span className="recipe-card-edit-label">Name</span>
                        <input className="sheets-input" type="text" value={String(draft.recipe_name ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], recipe_name: e.target.value } }))} disabled={isWriting} />
                      </div>
                      <div className="recipe-card-edit-field">
                        <span className="recipe-card-edit-label">Category</span>
                        <input className="sheets-input" type="text" value={String(draft.category ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], category: e.target.value } }))} disabled={isWriting} />
                      </div>
                      <div className="recipe-card-edit-field">
                        <span className="recipe-card-edit-label">Cook time</span>
                        <input className="sheets-input" type="text" value={String(draft.cook_time ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], cook_time: e.target.value } }))} disabled={isWriting} />
                      </div>
                      <div className="recipe-card-edit-field">
                        <span className="recipe-card-edit-label">Calories</span>
                        <input className="sheets-input" type="text" value={String(draft.calories ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], calories: e.target.value } }))} disabled={isWriting} />
                      </div>
                      <div className="recipe-card-edit-field">
                        <span className="recipe-card-edit-label">Servings</span>
                        <input className="sheets-input" type="text" value={String(draft.servings ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], servings: e.target.value } }))} disabled={isWriting} />
                      </div>
                      <div className="recipe-card-edit-field">
                        <span className="recipe-card-edit-label">Video link</span>
                        <input className="sheets-input" type="text" value={String(draft.video_link ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], video_link: e.target.value } }))} disabled={isWriting} />
                      </div>
                      <div className="recipe-card-edit-field">
                        <span className="recipe-card-edit-label">Website link</span>
                        <input className="sheets-input" type="text" value={String(draft.website_link ?? '')} onChange={(e) => setEditDrafts((p) => ({ ...p, [recipe.recipe_id]: { ...p[recipe.recipe_id], website_link: e.target.value } }))} disabled={isWriting} />
                      </div>
                    </div>
                    <div className="recipe-edit-mobile-actions">
                      <button type="button" className="secondary-action recipe-delete-btn" onClick={() => void handleDeleteRecipe(recipe.recipe_id)} disabled={!idToken || isWriting}>Delete</button>
                      <button type="button" className="secondary-action" onClick={() => { setEditingRecipeId(editingRecipeId === recipe.recipe_id ? null : recipe.recipe_id) }} disabled={isWriting}>
                        {editingRecipeId === recipe.recipe_id ? 'Done' : '⚙ Ingredients & Steps'}
                      </button>
                      <button type="button" className="secondary-action recipe-save-btn" onClick={() => void handleUpdateRecipe(recipe)} disabled={!idToken || isWriting}>Save</button>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {recipes.length > 0 && viewMode === 'grid' && !isEditing ? (
        <div className="recipe-cards-grid">
          {pagedRecipes.map((recipe) => {
            return (
              <div key={recipe.recipe_id} className="recipe-card">
                <>
                  <p className="recipe-card-title">{recipe.recipe_name}</p>
                  <p className="recipe-card-meta">
                    {[recipe.category, recipe.cook_time ? `⏱ ${recipe.cook_time}` : null, recipe.calories ? `🔥 ${recipe.calories} cal` : null, recipe.servings ? `${recipe.servings} srv` : null]
                      .filter(Boolean).join(' · ')}
                  </p>
                  <div className="recipe-card-actions">
                    <button type="button" className="secondary-action" onClick={() => setMakingRecipe(recipe)}>Make</button>
                  </div>
                </>
              </div>
            )
          })}
        </div>
      ) : null}

      {filteredRecipes.length > 0 && totalPages > 1 ? (
        <div className="recipe-pagination">
          <button
            type="button"
            className="secondary-action recipe-pagination-btn"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            ←
          </button>
          <span className="recipe-pagination-info">
            {currentPage} / {totalPages}
          </span>
          <button
            type="button"
            className="secondary-action recipe-pagination-btn"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            →
          </button>
        </div>
      ) : null}

      {managedRecipe && isEditing && canWrite ? (
        <div className="recipe-manage-panel">
          <p className="recipe-manage-heading">{managedRecipe.recipe_name}</p>

          <div className="recipe-manage-section">
            <div className="recipe-comp-tabs" role="tablist">
              {(['ingredient', 'equipment'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={draftCompType === tab}
                  className={`recipe-comp-tab${draftCompType === tab ? ' active' : ''}`}
                  onClick={() => { setDraftCompType(tab); setDraftCompName(''); setDraftCompQty(''); setDraftCompUnit(''); setDraftCompNote('') }}
                >
                  {tab === 'ingredient' ? 'Ingredients' : 'Equipment'}
                  <span className="recipe-comp-tab-count">
                    {managedComponents.filter((c) => c.type === tab).length}
                  </span>
                </button>
              ))}
            </div>

            {managedComponents.filter((c) => c.type === draftCompType).length > 0 ? (
              <ul className="recipe-comp-list">
                {managedComponents.filter((c) => c.type === draftCompType).map((c) => (
                  <li key={c.component_id} className={`recipe-comp-item${editingCompId === c.component_id ? ' recipe-comp-item--editing' : ''}`}>
                    {editingCompId === c.component_id ? (
                      <>
                        <div className="recipe-comp-edit-fields">
                          <input className="sheets-input" type="text" value={String(editCompDraft.name ?? c.name)} onChange={(e) => setEditCompDraft((p) => ({ ...p, name: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') void handleUpdateComponent(c); if (e.key === 'Escape') { setEditingCompId(null); setEditCompDraft({}) } }} disabled={isWriting} placeholder="Name *" autoFocus />
                          {draftCompType === 'ingredient' ? (
                            <>
                              <input className="sheets-input" type="text" value={String(editCompDraft.quantity ?? c.quantity)} onChange={(e) => setEditCompDraft((p) => ({ ...p, quantity: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') void handleUpdateComponent(c); if (e.key === 'Escape') { setEditingCompId(null); setEditCompDraft({}) } }} disabled={isWriting} placeholder="Qty" />
                              <input className="sheets-input" type="text" value={String(editCompDraft.unit ?? c.unit)} onChange={(e) => setEditCompDraft((p) => ({ ...p, unit: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') void handleUpdateComponent(c); if (e.key === 'Escape') { setEditingCompId(null); setEditCompDraft({}) } }} disabled={isWriting} placeholder="Unit" />
                              <input className="sheets-input recipe-comp-edit-note" type="text" value={String(editCompDraft.note ?? c.note)} onChange={(e) => setEditCompDraft((p) => ({ ...p, note: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') void handleUpdateComponent(c); if (e.key === 'Escape') { setEditingCompId(null); setEditCompDraft({}) } }} disabled={isWriting} placeholder="Note" />
                            </>
                          ) : null}
                        </div>
                        <div className="recipe-comp-edit-actions">
                          <button type="button" className="secondary-action" onClick={() => void handleUpdateComponent(c)} disabled={isWriting}>Save</button>
                          <button type="button" className="recipe-comp-delete" onClick={() => { setEditingCompId(null); setEditCompDraft({}) }}>✕</button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="recipe-comp-name">{c.name}</span>
                        {(c.quantity || c.unit) ? (
                          <span className="recipe-comp-qty">{[c.quantity, c.unit].filter(Boolean).join(' ')}</span>
                        ) : null}
                        {c.note ? <span className="recipe-comp-note">{c.note}</span> : null}
                        <button type="button" className="recipe-comp-edit-btn" aria-label={`Edit ${c.name}`} onClick={() => { setEditingCompId(c.component_id); setEditCompDraft({}) }}>✎</button>
                        <button type="button" className="recipe-comp-delete" aria-label={`Remove ${c.name}`} onClick={() => void handleDeleteComponent(c.component_id)} disabled={!idToken || isWriting}>✕</button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sheets-meta">No {draftCompType === 'ingredient' ? 'ingredients' : 'equipment'} yet.</p>
            )}

            {draftCompType === 'ingredient' ? (
              <div className="recipe-comp-add-form">
                <div className="recipe-comp-add-fields">
                  <div className="recipe-card-edit-field recipe-card-edit-field--full">
                    <span className="recipe-card-edit-label">Name *</span>
                    <input ref={compNameInputRef} className="sheets-input" type="text" value={draftCompName} onChange={(e) => setDraftCompName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleAddComponent(editingRecipeId!) }} disabled={isWriting} autoComplete="off" />
                  </div>
                  <div className="recipe-card-edit-field">
                    <span className="recipe-card-edit-label">Qty</span>
                    <input className="sheets-input" type="text" value={draftCompQty} onChange={(e) => setDraftCompQty(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleAddComponent(editingRecipeId!) }} disabled={isWriting} />
                  </div>
                  <div className="recipe-card-edit-field">
                    <span className="recipe-card-edit-label">Unit</span>
                    <input className="sheets-input" type="text" value={draftCompUnit} onChange={(e) => setDraftCompUnit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleAddComponent(editingRecipeId!) }} disabled={isWriting} />
                  </div>
                  <div className="recipe-card-edit-field recipe-card-edit-field--full">
                    <span className="recipe-card-edit-label">Note</span>
                    <input className="sheets-input" type="text" value={draftCompNote} onChange={(e) => setDraftCompNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleAddComponent(editingRecipeId!) }} disabled={isWriting} />
                  </div>
                </div>
                <button type="button" className="secondary-action" onClick={() => void handleAddComponent(editingRecipeId!)} disabled={!idToken || isWriting || !draftCompName.trim()}>Add ingredient</button>
              </div>
            ) : (
              <div className="recipe-comp-add-form recipe-comp-add-form--equipment">
                <div className="recipe-card-edit-field">
                  <span className="recipe-card-edit-label">Name *</span>
                  <input ref={compNameInputRef} className="sheets-input" type="text" value={draftCompName} onChange={(e) => setDraftCompName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleAddComponent(editingRecipeId!) }} disabled={isWriting} autoComplete="off" />
                </div>
                <button type="button" className="secondary-action" onClick={() => void handleAddComponent(editingRecipeId!)} disabled={!idToken || isWriting || !draftCompName.trim()}>Add equipment</button>
              </div>
            )}
          </div>

          <div className="recipe-manage-section">
            <p className="recipe-manage-heading recipe-manage-heading--sub">Steps</p>

            {managedSteps.length > 0 ? (
              <ol className="recipe-steps-edit-list">
                {managedSteps.map((s) => (
                  <li key={s.step_id} className={editingStepId === s.step_id ? 'recipe-step-edit-item recipe-step-edit-item--editing' : 'recipe-step-edit-item'}>
                    <span className="recipe-step-edit-number">{s.step_number}</span>
                    {editingStepId === s.step_id ? (
                      <>
                        <input className="sheets-input recipe-step-edit-input" type="text" value={editStepDraft} onChange={(e) => setEditStepDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleUpdateStep(s); if (e.key === 'Escape') { setEditingStepId(null); setEditStepDraft('') } }} disabled={isWriting} autoFocus />
                        <button type="button" className="secondary-action" onClick={() => void handleUpdateStep(s)} disabled={isWriting || !editStepDraft.trim()}>Save</button>
                        <button type="button" className="recipe-comp-delete" onClick={() => { setEditingStepId(null); setEditStepDraft('') }}>✕</button>
                      </>
                    ) : (
                      <>
                        <span className="recipe-step-edit-text">{s.instruction}</span>
                        <button type="button" className="recipe-comp-edit-btn" aria-label="Edit step" onClick={() => { setEditingStepId(s.step_id); setEditStepDraft(s.instruction) }}>✎</button>
                        <button type="button" className="recipe-comp-delete" aria-label="Remove step" onClick={() => void handleDeleteStep(s.step_id)} disabled={!idToken || isWriting}>✕</button>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="sheets-meta">No steps yet.</p>
            )}

            <div className="recipe-comp-add-form recipe-comp-add-form--step">
              <div className="recipe-card-edit-field recipe-card-edit-field--full">
                <span className="recipe-card-edit-label">Instruction * <span className="recipe-hint">(Enter to add)</span></span>
                <input ref={stepInputRef} className="sheets-input" type="text" value={draftStepInstruction} onChange={(e) => setDraftStepInstruction(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void handleAddStep(editingRecipeId!) }} disabled={isWriting} />
              </div>
              <button type="button" className="secondary-action" onClick={() => void handleAddStep(editingRecipeId!)} disabled={!idToken || isWriting || !draftStepInstruction.trim()}>Add step</button>
            </div>
          </div>
        </div>
      ) : null}

      {writeError ? <p className="sheets-error">{writeError}</p> : null}

      {makingRecipe ? (
        <div className="recipe-popup-backdrop" role="presentation" onClick={() => setMakingRecipe(null)}>
          <div className="recipe-popup" role="dialog" aria-modal="true" aria-label={`Make ${makingRecipe.recipe_name}`} onClick={(e) => e.stopPropagation()}>
            <MakeRecipePopup
              recipe={makingRecipe}
              components={components.filter((c) => c.recipe_id === makingRecipe.recipe_id)}
              steps={steps.filter((s) => s.recipe_id === makingRecipe.recipe_id)}
              onClose={() => setMakingRecipe(null)}
            />
          </div>
        </div>
      ) : null}
    </article>
  )
}

function OreoGangCard({ title }: { title: string }) {
  const [active, setActive] = useState<OreoMember>(OREO_GANG_MEMBERS[0])
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { image, description } = OREO_GANG_DATA[active]

  return (
    <article className="info-card section-page-card oreo-gang-card">
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
            <img
              key={active}
              src={image}
              alt={active}
              className="oreo-gang-photo oreo-gang-photo--loaded"
            />
            <p className="oreo-gang-description">{description}</p>
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

  async function handleUnpackAll() {
    if (!canWrite || !idToken || isWriting) return
    const packedRows = rows.filter((row) => row.packed)
    if (packedRows.length === 0) return

    setIsWriting(true)
    setWriteError('')
    const previousRows = rows
    setRows((prev) => prev.map((row) => ({ ...row, packed: false })))
    try {
      await Promise.all(
        packedRows.map((row) =>
          setBackpackPacked(idToken, { storage: row.storage, type: row.type, item: row.item, packed: false }),
        ),
      )
    } catch (error) {
      setRows(previousRows)
      setWriteError(error instanceof Error ? error.message : 'Unable to unpack all items')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleTogglePacked(row: BackpackRecord) {
    if (!canWrite || !idToken || isWriting) return
    const nextPacked = !row.packed
    setRows((prev) =>
      prev.map((r) =>
        r.item === row.item && r.storage === row.storage && r.type === row.type
          ? { ...r, packed: nextPacked }
          : r,
      ),
    )
    try {
      await setBackpackPacked(idToken, { storage: row.storage, type: row.type, item: row.item, packed: nextPacked })
    } catch (error) {
      setRows((prev) =>
        prev.map((r) =>
          r.item === row.item && r.storage === row.storage && r.type === row.type
            ? { ...r, packed: row.packed }
            : r,
        ),
      )
      setWriteError(error instanceof Error ? error.message : 'Unable to update packed status')
    }
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
            {canWrite ? (
              <button
                type="button"
                className="secondary-action"
                onClick={() => void handleUnpackAll()}
                disabled={!idToken || isWriting || !rows.some((row) => row.packed)}
              >
                Unpack all
              </button>
            ) : null}
          </div>

          <div className="sheets-table-shell">
            <table className="sheets-table">
              <thead>
                <tr>
                  {isEditing && canWrite ? <th>Storage</th> : null}
                  <th>Type</th>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Packed</th>
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
                    <td>
                      <input
                        type="checkbox"
                        checked={row.packed}
                        onChange={() => void handleTogglePacked(row)}
                        disabled={!canWrite || !idToken || isWriting}
                        aria-label={`${row.item} packed`}
                      />
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

function RecipeRandomizerCard({ title }: { title: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [recipes, setRecipes] = useState<RecipeRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [display, setDisplay] = useState('')
  const [tickKey, setTickKey] = useState(0)
  const [reelSpinning, setReelSpinning] = useState(false)
  const [result, setResult] = useState<RecipeRecord | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const data = await getRecipes()
        setRecipes(data)
        if (data.length > 0) setDisplay(data[0].recipe_name)
      } catch {
        setRecipes([])
      } finally {
        setIsLoading(false)
      }
    })()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  function spin() {
    if (spinning || recipes.length === 0) return
    sounds.randomizerClick()
    sounds.randomizerSpin()
    setSpinning(true)
    setReelSpinning(true)
    setResult(null)

    intervalRef.current = setInterval(() => {
      const r = recipes[Math.floor(Math.random() * recipes.length)]
      setDisplay(r.recipe_name)
      setTickKey((k) => k + 1)
    }, 80)

    timeoutRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      const final = recipes[Math.floor(Math.random() * recipes.length)]
      setDisplay(final.recipe_name)
      setTickKey((k) => k + 1)
      setReelSpinning(false)
      setResult(final)
      setSpinning(false)
    }, 2500)
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
          {isLoading ? <p className="sheets-meta">Loading recipes…</p> : null}
          {!isLoading && recipes.length === 0 ? (
            <p className="sheets-meta">No recipes yet — add some in the Recipes section first.</p>
          ) : null}

          {!isLoading && recipes.length > 0 ? (
            <>
              <div className="recipe-randomizer-reel-wrap">
                <div className={`meal-randomizer-window recipe-randomizer-window${reelSpinning ? ' spinning' : ''}`}>
                  <div className="meal-randomizer-shine" />
                  <span key={tickKey} className="meal-randomizer-item recipe-randomizer-item">
                    {display}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="meal-randomizer-spin-btn"
                disabled={spinning}
                onClick={spin}
              >
                {spinning ? 'Spinning…' : 'Pick a Recipe'}
              </button>

              {result ? (
                <div className="recipe-randomizer-result">
                  <p className="recipe-randomizer-result-name">{result.recipe_name}</p>
                  {result.category ? <p className="sheets-meta">{result.category}</p> : null}
                  {(result.cook_time || result.calories || result.servings) ? (
                    <div className="recipe-randomizer-meta">
                      {result.cook_time ? <span>⏱ {result.cook_time}</span> : null}
                      {result.calories ? <span>🔥 {result.calories} cal</span> : null}
                      {result.servings ? <span>🍽 {result.servings}</span> : null}
                    </div>
                  ) : null}
                  {(result.video_link || result.website_link) ? (
                    <div className="recipe-randomizer-links">
                      {result.video_link ? (
                        <a href={result.video_link} target="_blank" rel="noopener noreferrer" className="secondary-action">
                          Watch Video
                        </a>
                      ) : null}
                      {result.website_link ? (
                        <a href={result.website_link} target="_blank" rel="noopener noreferrer" className="secondary-action">
                          View Recipe
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </article>
  )
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
    sounds.randomizerClick()
    sounds.randomizerSpin()
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
  const [mobileDayIndex, setMobileDayIndex] = useState<number | null>(null)

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
    const weekdayOrder = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    return [...rows].sort((a, b) => {
      const dayDiff = weekdayOrder.indexOf(normalizeWeekday(a.day_of_the_week)) - weekdayOrder.indexOf(normalizeWeekday(b.day_of_the_week))
      if (dayDiff !== 0) {
        return dayDiff
      }

      return a.day_of_the_week.localeCompare(b.day_of_the_week)
    })
  }, [rows])

  useEffect(() => {
    if (sortedRows.length === 0) return
    const today = normalizeWeekday(getTodayWeekdayName())
    const idx = sortedRows.findIndex((row) => {
      const weekday = normalizeWeekday(row.day_of_the_week)
      return weekday === today || weekday.slice(0, 3) === today.slice(0, 3)
    })
    setMobileDayIndex(idx >= 0 ? idx : 0)
  }, [sortedRows])

  const mobileRow = mobileDayIndex !== null ? (sortedRows[mobileDayIndex] ?? null) : null

  const todayRow = useMemo(() => {
    const today = normalizeWeekday(getTodayWeekdayName())
    return rows.find((row) => {
      const weekday = normalizeWeekday(row.day_of_the_week)
      return weekday === today || weekday.slice(0, 3) === today.slice(0, 3)
    })
  }, [rows])

  function handleClearAll() {
    setEditedRows((current) => {
      const next = { ...current }
      for (const key of Object.keys(next)) {
        next[key] = { ...next[key], breakfast: '', lunch: '', dinner: '', snack: '' }
      }
      return next
    })
  }

  async function handleSaveAll() {
    if (!idToken || isWriting || !canWrite) return
    setIsWriting(true)
    setWriteError('')
    try {
      await Promise.all(
        rows.map((row) => {
          const draft = editedRows[row.day_of_the_week] ?? row
          return updateMealPlan(idToken, {
            originalDayOfTheWeek: row.day_of_the_week,
            dayOfTheWeek: row.day_of_the_week,
            breakfast: draft.breakfast.trim(),
            lunch: draft.lunch.trim(),
            dinner: draft.dinner.trim(),
            snack: draft.snack.trim(),
          })
        }),
      )
      await loadMealPlan()
      setIsEditing(false)
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
              {isWeeklyExpanded ? '▾' : '▸'}
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
          <div className="meal-plan-mobile-carousel">
            {sortedRows.length === 0 ? (
              <p className="sheets-meta">No meal plan rows found.</p>
            ) : mobileRow ? (
              <>
                <div className="meal-plan-mobile-nav">
                  <button
                    type="button"
                    className="meal-plan-nav-btn"
                    aria-label="Previous day"
                    onClick={() => setMobileDayIndex((i) => i === null || i === 0 ? sortedRows.length - 1 : i - 1)}
                  >
                    ‹
                  </button>
                  <span className="meal-plan-nav-day">{mobileRow.day_of_the_week}</span>
                  <button
                    type="button"
                    className="meal-plan-nav-btn"
                    aria-label="Next day"
                    onClick={() => setMobileDayIndex((i) => i === null || i >= sortedRows.length - 1 ? 0 : i + 1)}
                  >
                    ›
                  </button>
                </div>
                <div className="meal-plan-day-grid">
                  <div className="meal-plan-day-item">
                    <p className="meal-plan-label">Breakfast</p>
                    {isEditing && canWrite ? (
                      <input
                        className="sheets-input"
                        type="text"
                        value={editedRows[mobileRow.day_of_the_week]?.breakfast ?? mobileRow.breakfast}
                        onChange={(e) => setEditedRows((cur) => ({ ...cur, [mobileRow.day_of_the_week]: { ...(cur[mobileRow.day_of_the_week] ?? mobileRow), breakfast: e.target.value } }))}
                        disabled={!idToken || isWriting || !canWrite}
                      />
                    ) : (
                      <p>{mobileRow.breakfast || 'Not planned'}</p>
                    )}
                  </div>
                  <div className="meal-plan-day-item">
                    <p className="meal-plan-label">Lunch</p>
                    {isEditing && canWrite ? (
                      <input
                        className="sheets-input"
                        type="text"
                        value={editedRows[mobileRow.day_of_the_week]?.lunch ?? mobileRow.lunch}
                        onChange={(e) => setEditedRows((cur) => ({ ...cur, [mobileRow.day_of_the_week]: { ...(cur[mobileRow.day_of_the_week] ?? mobileRow), lunch: e.target.value } }))}
                        disabled={!idToken || isWriting || !canWrite}
                      />
                    ) : (
                      <p>{mobileRow.lunch || 'Not planned'}</p>
                    )}
                  </div>
                  <div className="meal-plan-day-item">
                    <p className="meal-plan-label">Dinner</p>
                    {isEditing && canWrite ? (
                      <input
                        className="sheets-input"
                        type="text"
                        value={editedRows[mobileRow.day_of_the_week]?.dinner ?? mobileRow.dinner}
                        onChange={(e) => setEditedRows((cur) => ({ ...cur, [mobileRow.day_of_the_week]: { ...(cur[mobileRow.day_of_the_week] ?? mobileRow), dinner: e.target.value } }))}
                        disabled={!idToken || isWriting || !canWrite}
                      />
                    ) : (
                      <p>{mobileRow.dinner || 'Not planned'}</p>
                    )}
                  </div>
                  <div className="meal-plan-day-item">
                    <p className="meal-plan-label">Snack</p>
                    {isEditing && canWrite ? (
                      <input
                        className="sheets-input"
                        type="text"
                        value={editedRows[mobileRow.day_of_the_week]?.snack ?? mobileRow.snack}
                        onChange={(e) => setEditedRows((cur) => ({ ...cur, [mobileRow.day_of_the_week]: { ...(cur[mobileRow.day_of_the_week] ?? mobileRow), snack: e.target.value } }))}
                        disabled={!idToken || isWriting || !canWrite}
                      />
                    ) : (
                      <p>{mobileRow.snack || 'Not planned'}</p>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
          <div className="meal-plan-desktop-table">
          <div className="sheets-table-shell meal-plan-table-shell">
            <table className="sheets-table meal-plan-table">
              <thead>
                <tr>
                  <th>Day of week</th>
                  <th>Breakfast</th>
                  <th>Lunch</th>
                  <th>Dinner</th>
                  <th>Snack</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.day_of_the_week}>
                    <td data-label="Day of week">{row.day_of_the_week}</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sortedRows.length === 0 ? <p className="sheets-meta">No meal plan rows found.</p> : null}
          </div>
          {isEditing && canWrite ? (
            <div className="meal-plan-edit-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={handleClearAll}
                disabled={isWriting}
              >
                Clear All
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => void handleSaveAll()}
                disabled={!idToken || isWriting}
              >
                {isWriting ? 'Saving…' : 'Save'}
              </button>
            </div>
          ) : null}
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
    setRows((prev) => prev.map((r) => ({ ...r, include: false, completed: false })))
    setIsWriting(true)
    setWriteError('')
    try {
      await Promise.all(
        included.map((row) =>
          updateGroceryListItem(idToken, {
            originalItem: row.item,
            item: row.item,
            type: row.type,
            completed: false,
            include: false,
          }),
        ),
      )
    } catch (error) {
      setRows((prev) => prev.map((r) => {
        const wasIncluded = included.find((ir) => ir.item === r.item)
        return wasIncluded ? { ...r, include: true, completed: r.completed } : r
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

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip, TimeScale)

// ── Health dashboard helpers ───────────────────────────────────────────────

// Normalise sheet date strings (MM/DD/YYYY or YYYY-MM-DD) → YYYY-MM-DD for
// consistent sorting and Chart.js time scale parsing.
function parseToISO(dateStr: string): string {
  const s = dateStr.trim()
  const parts = s.split('/')
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
  }
  return s.slice(0, 10)
}

function hMean(vals: number[]): number {
  const clean = vals.filter(v => isFinite(v) && v > 0)
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : 0
}

function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

type TrendDir = 'up' | 'down' | 'flat'

function trendDir(recent: number, prev: number, higherBetter = true): TrendDir {
  if (!recent || !prev) return 'flat'
  const pct = (recent - prev) / prev
  if (Math.abs(pct) < 0.03) return 'flat'
  return (pct > 0) === higherBetter ? 'up' : 'down'
}

// ── HealthLineChart (Chart.js) ─────────────────────────────────────────────

// Per-scale time unit and display format for Chart.js time scale
const TIME_SCALE_CFG: Record<ChartScale, {
  unit: 'day' | 'week' | 'month'
  dayFmt: string
  weekFmt: string
  monthFmt: string
  maxTicks: number
}> = {
  '1W':  { unit: 'day',   dayFmt: 'EEE MM/dd', weekFmt: 'MM/dd', monthFmt: 'MMM',    maxTicks: 7  },
  '1M':  { unit: 'week',  dayFmt: 'MM/dd',      weekFmt: 'MM/dd', monthFmt: 'MMM',    maxTicks: 5  },
  '1Y':  { unit: 'month', dayFmt: 'MM/dd',      weekFmt: 'MM/dd', monthFmt: 'MMM',    maxTicks: 12 },
  'all': { unit: 'month', dayFmt: 'MM/dd',      weekFmt: 'MM/dd', monthFmt: "MMM yy", maxTicks: 24 },
}

function HealthLineChart({
  points, color, unit, minWidth, scale,
}: {
  points: { date: string; value: number }[]
  color: string
  unit: string
  minWidth: string
  scale: ChartScale
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    chartRef.current?.destroy()
    chartRef.current = null

    if (!canvasRef.current || points.length < 2) return

    const style     = getComputedStyle(document.documentElement)
    const gridColor = style.getPropertyValue('--border').trim()     || 'rgba(127,127,127,0.15)'
    const tickColor = style.getPropertyValue('--text-muted').trim() || 'rgba(127,127,127,0.65)'
    const fillColor = color + Math.round(0.18 * 255).toString(16).padStart(2, '0')

    const cfg = TIME_SCALE_CFG[scale]

    // For 1Y and all, pick a time unit based on the actual data span so we
    // always produce visible ticks even when data is sparse.
    let timeUnit: 'day' | 'week' | 'month' = cfg.unit
    if ((scale === '1Y' || scale === 'all') && points.length >= 2) {
      const ms   = new Date(points[points.length - 1].date).getTime() - new Date(points[0].date).getTime()
      const days = ms / 86_400_000
      if      (days < 14)  timeUnit = 'day'
      else if (days < 90)  timeUnit = 'week'
      else                 timeUnit = 'month'
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        datasets: [{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data:                 points.map(p => ({ x: p.date, y: p.value })) as any,
          borderColor:          color,
          backgroundColor:      fillColor,
          borderWidth:          2,
          fill:                 true,
          tension:              0.35,
          pointRadius:          points.length > 60 ? 0 : 3,
          pointHoverRadius:     5,
          pointBackgroundColor: color,
          pointBorderColor:     'transparent',
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: false,
        animation:           { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label:  ctx => `${(ctx.parsed.y as number).toFixed(1)}${unit ? ' ' + unit : ''}`,
              title:  items => {
                if (!items[0]) return ''
                return new Date(items[0].parsed.x as number).toLocaleDateString('en-US', {
                  month: '2-digit', day: '2-digit', year: 'numeric',
                })
              },
            },
          },
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit:           timeUnit,
              displayFormats: { day: cfg.dayFmt, week: cfg.weekFmt, month: cfg.monthFmt },
            },
            ticks: {
              color:         tickColor,
              font:          { size: 10 },
              maxRotation:   0,
              maxTicksLimit: cfg.maxTicks,
            },
            grid:   { color: gridColor },
            border: { color: gridColor },
          },
          y: {
            ticks: {
              color:    tickColor,
              font:     { size: 10 },
              callback: v => `${v}${unit}`,
            },
            grid:   { color: gridColor },
            border: { color: gridColor },
          },
        },
      },
    })

    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
    }
  }, [points, color, unit, scale])

  return (
    <div className="health-chart-scroll">
      <div className="health-chart-inner" style={{ minWidth }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  )
}

// ── Health source types ────────────────────────────────────────────────────

type HealthSource = 'garmin' | 'ringconn' | 'apple'

const HEALTH_SOURCE_LABELS: Record<HealthSource, string> = {
  garmin:   'Garmin',
  ringconn: 'Ringconn',
  apple:    'Apple Health',
}

const GARMIN_COLS:   (keyof GarminHealthRecord)[]   = ['date', 'activity_type', 'title', 'distance_mi', 'duration_min', 'avg_hr', 'max_hr', 'calories', 'tss']
const RINGCONN_COLS: (keyof RingconnHealthRecord)[] = ['date', 'sleep_score', 'sleep_duration_h', 'deep_sleep_h', 'rem_sleep_h', 'resting_hr', 'hrv', 'spo2', 'steps', 'calories']
const APPLE_COLS:    (keyof AppleHealthRecord)[]    = ['date', 'steps', 'resting_hr', 'hrv_sdnn', 'active_calories', 'sleep_h', 'spo2_avg', 'weight_kg']

// Condensed column sets for narrow screens
const MOBILE_GARMIN_COLS:   (keyof GarminHealthRecord)[]   = ['date', 'activity_type', 'distance_mi', 'duration_min']
const MOBILE_RINGCONN_COLS: (keyof RingconnHealthRecord)[] = ['date', 'sleep_score', 'sleep_duration_h', 'hrv']
const MOBILE_APPLE_COLS:    (keyof AppleHealthRecord)[]    = ['date', 'steps', 'resting_hr', 'hrv_sdnn']

type ChartScale = '1W' | '1M' | '1Y' | 'all'
const SCALE_DAYS: Record<ChartScale, number> = { '1W': 7, '1M': 30, '1Y': 365, 'all': 0 }
const SCALE_LABELS: Record<ChartScale, string> = { '1W': '1W', '1M': '1M', '1Y': '1Y', 'all': 'All' }

const CHART_CFG: Record<HealthSource, { label: string; color: string; unit: string; metricKey: string }> = {
  garmin:   { label: 'Distance per Activity', color: '#FC5200', unit: 'mi',  metricKey: 'distance_mi'  },
  ringconn: { label: 'Sleep Score',           color: '#8B5CF6', unit: '',    metricKey: 'sleep_score'  },
  apple:    { label: 'Resting Heart Rate',    color: '#30D158', unit: 'bpm', metricKey: 'resting_hr'   },
}

function HealthDataCard({ title }: { title: string }) {
  const [source,     setSource]     = useState<HealthSource>('garmin')
  const [page,       setPage]       = useState(0)
  const [chartScale, setChartScale] = useState<ChartScale>('1M')
  const [isMobile,   setIsMobile]   = useState(() => window.matchMedia('(max-width: 640px)').matches)

  // Reset page and chart scale whenever the active source tab changes
  useEffect(() => { setPage(0); setChartScale('1M') }, [source])

  // Track viewport width so chart and columns update on resize
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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
  const fullCols   = source === 'garmin' ? GARMIN_COLS    : source === 'ringconn' ? RINGCONN_COLS    : APPLE_COLS
  const mobileCols = source === 'garmin' ? MOBILE_GARMIN_COLS : source === 'ringconn' ? MOBILE_RINGCONN_COLS : MOBILE_APPLE_COLS
  const cols       = isMobile ? mobileCols : fullCols
  const sortedRows = [...allRows].sort((a, b) => parseToISO(b.date).localeCompare(parseToISO(a.date)))
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / 10))
  const pageRows   = sortedRows.slice(page * 10, (page + 1) * 10)
  const lastSync   = sortedRows.length > 0 ? sortedRows[0].date.slice(0, 10) : null

  // ── Well-being overview (cross-source) ──────────────────────────────────
  const { wbTiles, wbInsight } = useMemo(() => {
    const n30 = daysAgoISO(30), n7 = daysAgoISO(7), n14 = daysAgoISO(14)

    const g30  = garminRows.filter(r => parseToISO(r.date) >= n30)
    const r30  = ringconnRows.filter(r => parseToISO(r.date) >= n30)
    const a30  = appleRows.filter(r => parseToISO(r.date) >= n30)
    const r7   = ringconnRows.filter(r => parseToISO(r.date) >= n7)
    const rP7  = ringconnRows.filter(r => { const d = parseToISO(r.date); return d >= n14 && d < n7 })

    const workouts   = g30.length
    const avgDist    = hMean(g30.map(r => parseFloat(r.distance_mi)))
    const sleepScore = hMean(r30.map(r => parseFloat(r.sleep_score)))
    const sleepHours = hMean(r30.map(r => parseFloat(r.sleep_duration_h)))
    const restHR     = r30.length > 0
      ? hMean(r30.map(r => parseFloat(r.resting_hr)))
      : hMean(a30.map(r => parseFloat(r.resting_hr)))
    const hrv        = r30.length > 0
      ? hMean(r30.map(r => parseFloat(r.hrv)))
      : hMean(a30.map(r => parseFloat(r.hrv_sdnn)))

    const sleepTrend = trendDir(hMean(r7.map(r => parseFloat(r.sleep_score))), hMean(rP7.map(r => parseFloat(r.sleep_score))))
    const hrvTrend   = trendDir(hMean(r7.map(r => parseFloat(r.hrv))),         hMean(rP7.map(r => parseFloat(r.hrv))))
    const hrTrend    = trendDir(hMean(r7.map(r => parseFloat(r.resting_hr))),  hMean(rP7.map(r => parseFloat(r.resting_hr))), false)

    const tiles: { label: string; value: string; trend: TrendDir }[] = [
      { label: 'Workouts / 30d', value: workouts   > 0 ? String(workouts)                  : '—', trend: 'flat' },
      { label: 'Avg Distance',   value: avgDist    > 0 ? `${avgDist.toFixed(1)} mi`        : '—', trend: 'flat' },
      { label: 'Sleep Score',    value: sleepScore > 0 ? `${Math.round(sleepScore)} / 100` : '—', trend: sleepTrend },
      { label: 'Avg Sleep',      value: sleepHours > 0 ? `${sleepHours.toFixed(1)} h`      : '—', trend: 'flat' },
      { label: 'Resting HR',     value: restHR     > 0 ? `${Math.round(restHR)} bpm`       : '—', trend: hrTrend },
      { label: 'Avg HRV',        value: hrv        > 0 ? `${Math.round(hrv)} ms`           : '—', trend: hrvTrend },
    ]

    const parts: string[] = []
    if      (sleepScore >= 80)                   parts.push('Sleep quality is strong')
    else if (sleepScore > 0 && sleepScore < 65)  parts.push('Sleep score is below target — prioritize rest')
    if      (hrv > 0 && hrvTrend === 'up')       parts.push('HRV trending up — recovery adapting well')
    else if (hrv > 0 && hrvTrend === 'down')     parts.push('HRV dipping — consider an easier week')
    if      (workouts >= 16)                     parts.push(`${workouts} workouts this month — consistency is high`)
    else if (workouts > 0 && workouts < 8)       parts.push('Training frequency is low — aim for more sessions')

    return {
      wbTiles: tiles,
      wbInsight: parts.slice(0, 2).join('. ') + (parts.length ? '.' : ''),
    }
  }, [garminRows, ringconnRows, appleRows])

  const anyData = garminRows.length > 0 || ringconnRows.length > 0 || appleRows.length > 0
  const allLoading = garminLoading && ringconnLoading && appleLoading

  // ── Chart data for active source ─────────────────────────────────────────
  const cfg = CHART_CFG[source]

  const chartPoints = useMemo(() => {
    const cutoff = chartScale === 'all' ? '' : daysAgoISO(SCALE_DAYS[chartScale])
    return [...allRows]
      .sort((a, b) => parseToISO(a.date).localeCompare(parseToISO(b.date)))
      .map(r => ({ date: parseToISO(r.date), value: parseFloat((r as Record<string, string>)[cfg.metricKey] ?? '') }))
      .filter(p => !isNaN(p.value) && p.value > 0 && (chartScale === 'all' || p.date >= cutoff))
  }, [allRows, cfg.metricKey, chartScale])

  const canvasMinWidth = useMemo(() => {
    if (isMobile) return '100%'
    if (chartScale === '1W' || chartScale === '1M') return '100%'
    if (chartScale === '1Y') return '1000px'
    return `${Math.max(1200, chartPoints.length * 6)}px`
  }, [chartScale, chartPoints.length, isMobile])

  return (
    <article className="info-card section-page-card health-data-card">
      <h3>{title}</h3>

      {/* ── Well-being overview ── */}
      {!allLoading && anyData && (
        <div className="wellbeing-section">
          <div className="wellbeing-grid">
            {wbTiles.map(tile => (
              <div key={tile.label} className="wellbeing-stat">
                <span className="wellbeing-stat-value">{tile.value}</span>
                <span className="wellbeing-stat-meta">
                  <span className="wellbeing-stat-label">{tile.label}</span>
                  {tile.trend !== 'flat' && (
                    <span className={`wellbeing-trend-${tile.trend}`}>
                      {tile.trend === 'up' ? '↑' : '↓'}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          {wbInsight && <p className="wellbeing-insight">{wbInsight}</p>}
        </div>
      )}

      {/* ── Source tabs ── */}
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
          {/* ── Chart ── */}
          <div className="health-chart-container">
            <div className="health-chart-controls">
              <div className="health-scale-btns" role="group" aria-label="Chart time range">
                {(Object.keys(SCALE_LABELS) as ChartScale[]).map(s => (
                  <button
                    key={s}
                    className={`health-scale-btn ${chartScale === s ? 'active' : ''}`}
                    onClick={() => setChartScale(s)}
                  >
                    {SCALE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {chartPoints.length < 2 ? (
              <div className="health-chart-empty">No data for this time range</div>
            ) : (
              <HealthLineChart
                points={chartPoints}
                color={cfg.color}
                unit={cfg.unit}
                minWidth={canvasMinWidth}
                scale={chartScale}
              />
            )}

            <p className="health-chart-label">{cfg.label} · {chartPoints.length} {chartPoints.length === 1 ? 'entry' : 'entries'}</p>
          </div>

          <p className="sheets-meta">
            {allRows.length} records · last synced {lastSync}
          </p>

          {/* ── Raw data table ── */}
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
                {pageRows.map((row, i) => (
                  <tr key={i}>
                    {cols.map((col) => {
                      const raw  = (row as Record<string, string>)[col] ?? ''
                      const cell = col === 'date' ? raw.slice(0, 10) : raw
                      return <td key={col}>{cell || '—'}</td>
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="health-table-pagination">
              <button
                className="health-pagination-btn"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                aria-label="Previous page"
              >
                ‹
              </button>
              <span className="health-pagination-info">{page + 1} / {totalPages}</span>
              <button
                className="health-pagination-btn"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                aria-label="Next page"
              >
                ›
              </button>
            </div>
          )}

          {isMobile && (
            <p className="health-desktop-note">More data analysis available on desktop.</p>
          )}
        </>
      )}
    </article>
  )
}

function PointsConversionPage() {
  const categories = [
    { label: 'Trips', icon: '✈️', description: 'Convert points into flights, travel credits, and vacation packages.' },
    { label: 'Miles', icon: '🛣️', description: 'See how far your points take you in airline miles and rewards.' },
    { label: 'Food', icon: '🍽️', description: 'Redeem points for dining credits, delivery, and restaurant rewards.' },
    { label: 'Hotel', icon: '🏨', description: 'Turn points into hotel nights, upgrades, and loyalty rewards.' },
  ]

  return (
    <PageFrame
      eyebrow="Coming soon"
      title="Points Conversion"
      summary="Convert your credit card points into real-world value across travel, dining, and hotel rewards."
      accent="#1f8f3a"
      backLink="/finances"
      backLabel="Back to Finances"
      note="This page is a placeholder — full conversion logic coming soon."
    >
      {categories.map((cat) => (
        <article key={cat.label} className="info-card section-page-card points-conversion-card">
          <div className="points-conversion-icon">{cat.icon}</div>
          <h3>{cat.label}</h3>
          <p>{cat.description}</p>
          <p className="points-conversion-badge">Coming soon</p>
        </article>
      ))}
    </PageFrame>
  )
}

const GROCERY_STORES = ['Walmart', 'Target', 'Publix', 'Aldi'] as const
type GroceryStore = (typeof GROCERY_STORES)[number]

const FAST_FOOD_PLACES = [
  "McDonald's", 'Burger King', 'Chick-fil-A', 'Chipotle', 'Taco Bell',
  'Subway', "Wendy's", 'Panda Express', 'Popeyes', "Raising Cane's", 'Other',
]

type FlippDeal = {
  id: string
  item: string
  brand: string | null
  price: number | null
  validFrom: string | null
  validTo: string | null
}

type FlippStoreData = {
  validFrom: string | null
  validTo: string | null
  deals: FlippDeal[]
  error?: string
}

type FlippData = {
  lastUpdated: string | null
  stores: Record<string, FlippStoreData>
}

type StoreCostStats = {
  store: GroceryStore
  count: number
  avg: number | null
  cheapest: FlippDeal | null
  priciest: FlippDeal | null
}

type UnitInfo = { qty: number; unit: string }

// Best-effort: pull a "12 oz" / "5-lb" / "1 gal" style quantity out of a flyer
// item's free-text name so unit cost can be estimated. Returns null if no
// recognizable quantity+unit is present.
const UNIT_PATTERN =
  /(\d+(?:\.\d+)?)\s*-?\s*(fl\.?\s*oz|ounces?|oz|pounds?|lbs?|gallons?|gal|quarts?|qt|count|ct|packs?|pk|kg|g|ml|l)\b/i

function parseUnitInfo(name: string): UnitInfo | null {
  const m = name.match(UNIT_PATTERN)
  if (!m) return null
  const qty = parseFloat(m[1])
  if (!qty || qty <= 0) return null
  const raw = m[2].toLowerCase().replace(/\./g, '').replace(/\s+/g, '')
  let unit = raw
  if (raw.startsWith('fl')) unit = 'fl oz'
  else if (raw.startsWith('ounce') || raw === 'oz') unit = 'oz'
  else if (raw.startsWith('pound') || raw.startsWith('lb')) unit = 'lb'
  else if (raw.startsWith('gallon') || raw === 'gal') unit = 'gal'
  else if (raw.startsWith('quart') || raw === 'qt') unit = 'qt'
  else if (raw.startsWith('count') || raw === 'ct') unit = 'ct'
  else if (raw.startsWith('pack') || raw === 'pk') unit = 'pk'
  return { qty, unit }
}

const COST_SEARCH_PER_PAGE = 5

function GroceryPriceCard({
  title,
  fallbackBody,
}: {
  title: string
  fallbackBody: string
}) {
  const [flippData, setFlippData] = useState<FlippData | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/deals-data.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<FlippData> })
      .then((d) => { setFlippData(d); setIsLoading(false) })
      .catch((e: unknown) => {
        setFetchError(e instanceof Error ? e.message : 'Failed to load prices')
        setIsLoading(false)
      })
  }, [])

  const storeStats: StoreCostStats[] = useMemo(() => {
    return GROCERY_STORES.map((store) => {
      const deals = (flippData?.stores[store]?.deals ?? []).filter((d) => d.price != null)
      if (deals.length === 0) {
        return { store, count: 0, avg: null, cheapest: null, priciest: null }
      }
      const avg = deals.reduce((sum, d) => sum + (d.price ?? 0), 0) / deals.length
      const cheapest = deals.reduce((best, d) => (d.price! < best.price! ? d : best))
      const priciest = deals.reduce((worst, d) => (d.price! > worst.price! ? d : worst))
      return { store, count: deals.length, avg, cheapest, priciest }
    })
  }, [flippData])

  const bestValueStore = useMemo(() => {
    const ranked = storeStats.filter((s) => s.avg != null)
    if (!ranked.length) return null
    return ranked.reduce((best, s) => (s.avg! < best.avg! ? s : best)).store
  }, [storeStats])

  const allPricedDeals = useMemo(() => {
    if (!flippData) return []
    return GROCERY_STORES.flatMap((store) =>
      (flippData.stores[store]?.deals ?? [])
        .filter((d) => d.price != null)
        .map((d) => ({ ...d, _store: store, unit: parseUnitInfo(d.item) })),
    )
  }, [flippData])

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    const seen = new Set<string>()
    return allPricedDeals
      .filter((d) => d.item.toLowerCase().includes(q) || (d.brand ?? '').toLowerCase().includes(q))
      .filter((d) => {
        const key = `${d._store}|${d.item}|${d.price}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .map((d) => ({ ...d, effectivePrice: d.unit ? d.price! / d.unit.qty : d.price! }))
      .sort((a, b) => a.effectivePrice - b.effectivePrice)
  }, [allPricedDeals, search])

  const totalPages = Math.max(1, Math.ceil(searchResults.length / COST_SEARCH_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const pagedResults = searchResults.slice(
    (currentPage - 1) * COST_SEARCH_PER_PAGE,
    currentPage * COST_SEARCH_PER_PAGE,
  )

  return (
    <article className="info-card section-page-card sheets-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((v) => !v)}
          >{isCollapsed ? '▸' : '▾'}</button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          {isLoading ? <p className="sheets-meta">Loading prices from this week's flyers…</p> : null}
          {fetchError ? <p className="sheets-error">{fetchError}</p> : null}

          {!isLoading && !fetchError && flippData ? (
            <>
              <p className="sheets-meta">{fallbackBody}</p>

              <div className="deals-filters">
                <input
                  className="sheets-input deals-search"
                  placeholder="Search an item (e.g. milk, chicken, eggs)…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                />
              </div>

              {search.trim() ? (
                searchResults.length === 0 ? (
                  <p className="sheets-meta">No matching items in this week's flyers.</p>
                ) : (
                  <>
                    <div className="cost-search-list">
                      {pagedResults.map((d, idx) => (
                        <div
                          key={d.id}
                          className={`cost-search-row ${currentPage === 1 && idx === 0 ? 'best-deal' : ''}`}
                        >
                          <div className="cost-search-main">
                            <span className="cost-search-item">{d.item}</span>
                            <span className="deal-card-cat deal-store-label">{d._store}</span>
                            {currentPage === 1 && idx === 0 ? (
                              <span className="price-best-badge">Best deal</span>
                            ) : null}
                          </div>
                          <div className="cost-search-prices">
                            <span className="deal-sale-price">${d.price!.toFixed(2)}</span>
                            {d.unit ? (
                              <span className="cost-search-unit">
                                ${(d.price! / d.unit.qty).toFixed(2)}/{d.unit.unit}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>

                    {totalPages > 1 ? (
                      <div className="deals-pagination">
                        <button
                          type="button"
                          className="deals-page-btn"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >‹ Prev</button>
                        <span className="deals-page-status">Page {currentPage} of {totalPages}</span>
                        <button
                          type="button"
                          className="deals-page-btn"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >Next ›</button>
                      </div>
                    ) : null}
                  </>
                )
              ) : (
                <div className="cost-analysis-grid">
                  {storeStats.map(({ store, count, avg, cheapest, priciest }) => (
                    <div
                      key={store}
                      className={`cost-analysis-card ${bestValueStore === store ? 'best-value' : ''}`}
                    >
                      <div className="cost-analysis-store-row">
                        <span className="cost-analysis-store">{store}</span>
                        {bestValueStore === store ? (
                          <span className="price-best-badge">Best value</span>
                        ) : null}
                      </div>
                      {count === 0 ? (
                        <p className="sheets-meta">No flyer data this week.</p>
                      ) : (
                        <>
                          <p className="cost-analysis-avg">
                            Avg deal price: <strong>${avg!.toFixed(2)}</strong>
                          </p>
                          <p className="cost-analysis-stat">{count} deals tracked</p>
                          {cheapest ? (
                            <p className="cost-analysis-stat">
                              Cheapest: {cheapest.item} — ${cheapest.price!.toFixed(2)}
                            </p>
                          ) : null}
                          {priciest ? (
                            <p className="cost-analysis-stat">
                              Priciest: {priciest.item} — ${priciest.price!.toFixed(2)}
                            </p>
                          ) : null}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </article>
  )
}

function StoreDealsCard({
  title,
  fallbackBody,
}: {
  title: string
  fallbackBody: string
}) {
  const [flippData, setFlippData] = useState<FlippData | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [activeStore, setActiveStore] = useState<GroceryStore | 'All'>('All')
  const [search, setSearch] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [page, setPage] = useState(1)
  const DEALS_PER_PAGE = 5

  useEffect(() => {
    fetch('/deals-data.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<FlippData> })
      .then((d) => { setFlippData(d); setIsLoading(false) })
      .catch((e: unknown) => {
        setFetchError(e instanceof Error ? e.message : 'Failed to load deals')
        setIsLoading(false)
      })
  }, [])

  const activeStoreData: FlippStoreData | null =
    flippData && activeStore !== 'All' ? (flippData.stores[activeStore] ?? null) : null

  const visibleDeals = useMemo(() => {
    const source =
      activeStore === 'All'
        ? Object.entries(flippData?.stores ?? {}).flatMap(([store, sd]) =>
            sd.deals.map((d) => ({ ...d, _store: store })),
          )
        : (activeStoreData?.deals.map((d) => ({ ...d, _store: activeStore })) ?? [])

    const q = search.toLowerCase()
    const min = minPrice.trim() ? parseFloat(minPrice) : null
    const max = maxPrice.trim() ? parseFloat(maxPrice) : null

    const seen = new Set<string>()
    return source
      .filter((d) => !q || d.item.toLowerCase().includes(q) || (d.brand ?? '').toLowerCase().includes(q))
      .filter((d) => min == null || (d.price != null && d.price >= min))
      .filter((d) => max == null || (d.price != null && d.price <= max))
      .filter((d) => {
        const key = `${d._store}|${d.item}|${d.price}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))
  }, [flippData, activeStore, activeStoreData, search, minPrice, maxPrice])

  const totalDeals = Object.values(flippData?.stores ?? {}).reduce(
    (sum, s) => sum + s.deals.length, 0,
  )

  const totalPages = Math.max(1, Math.ceil(visibleDeals.length / DEALS_PER_PAGE))
  const currentPage = Math.min(page, totalPages)
  const pagedDeals = visibleDeals.slice(
    (currentPage - 1) * DEALS_PER_PAGE,
    currentPage * DEALS_PER_PAGE,
  )

  function formatDate(iso: string | null | undefined) {
    if (!iso) return null
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function renderFlippDeal(deal: FlippDeal & { _store?: string }) {
    return (
      <div key={deal.id} className="deal-card">
        <div className="deal-card-main">
          <span className="deal-card-item">{deal.item}</span>
          {deal.brand ? <span className="deal-card-cat">{deal.brand}</span> : null}
          {activeStore === 'All' && deal._store ? (
            <span className="deal-card-cat deal-store-label">{deal._store}</span>
          ) : null}
        </div>
        <div className="deal-card-prices">
          {deal.price != null ? (
            <span className="deal-sale-price">${deal.price.toFixed(2)}</span>
          ) : null}
        </div>
        <div className="deal-card-meta">
          {deal.validTo ? <span className="deal-expiry">thru {formatDate(deal.validTo)}</span> : null}
        </div>
      </div>
    )
  }

  return (
    <article className="info-card section-page-card sheets-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((v) => !v)}
          >{isCollapsed ? '▸' : '▾'}</button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          {isLoading ? <p className="sheets-meta">Loading deals from Flipp…</p> : null}
          {fetchError ? <p className="sheets-error">{fetchError}</p> : null}

          {!isLoading && !fetchError && flippData ? (
            <>
              <div className="deals-flipp-meta">
                {flippData.lastUpdated ? (
                  <span className="deals-last-updated">
                    Updated {new Date(flippData.lastUpdated).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                ) : null}
                <span className="deals-count">{totalDeals} deals</span>
              </div>

              <div className="deals-store-tabs">
                {(['All', ...GROCERY_STORES] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`deals-store-tab-btn ${activeStore === s ? 'active' : ''}`}
                    onClick={() => { setActiveStore(s as GroceryStore | 'All'); setSearch(''); setPage(1) }}
                  >
                    {s}
                    {s !== 'All' && flippData.stores[s]?.deals.length
                      ? <span className="tab-count">{flippData.stores[s].deals.length}</span>
                      : null}
                  </button>
                ))}
              </div>

              {activeStore !== 'All' && activeStoreData?.validFrom ? (
                <p className="sheets-meta deal-validity">
                  Valid {formatDate(activeStoreData.validFrom)} – {formatDate(activeStoreData.validTo)}
                  {activeStoreData.error ? ` · ${activeStoreData.error}` : ''}
                </p>
              ) : null}

              <div className="deals-filters">
                <input
                  className="sheets-input deals-search"
                  placeholder="Search deals…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                />
                <input
                  className="sheets-input deals-price-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Min $"
                  value={minPrice}
                  onChange={(e) => { setMinPrice(e.target.value); setPage(1) }}
                />
                <input
                  className="sheets-input deals-price-input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Max $"
                  value={maxPrice}
                  onChange={(e) => { setMaxPrice(e.target.value); setPage(1) }}
                />
              </div>

              {visibleDeals.length === 0 ? (
                <p className="sheets-meta">{fallbackBody}</p>
              ) : (
                <>
                  <div className="deal-cards-list">
                    {pagedDeals.map(renderFlippDeal)}
                  </div>

                  {totalPages > 1 ? (
                    <div className="deals-pagination">
                      <button
                        type="button"
                        className="deals-page-btn"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >‹ Prev</button>
                      <span className="deals-page-status">Page {currentPage} of {totalPages}</span>
                      <button
                        type="button"
                        className="deals-page-btn"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >Next ›</button>
                    </div>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </>
      ) : null}
    </article>
  )
}

const COUPON_STORAGE_KEY = 'gp_coupons_v1'

function CouponsCard({
  title,
  fallbackBody,
}: {
  title: string
  fallbackBody: string
}) {
  const [rows, setRows] = useState<CouponRecord[]>(() => {
    try {
      const s = localStorage.getItem(COUPON_STORAGE_KEY)
      return s ? (JSON.parse(s) as CouponRecord[]) : []
    } catch { return [] }
  })
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'grocery' | 'fastfood'>('grocery')
  const [showAddForm, setShowAddForm] = useState(false)
  const [draftPlace, setDraftPlace] = useState('')
  const [draftType, setDraftType] = useState<'grocery' | 'fastfood'>('grocery')
  const [draftDesc, setDraftDesc] = useState('')
  const [draftDiscount, setDraftDiscount] = useState('')
  const [draftCode, setDraftCode] = useState('')
  const [draftExpiry, setDraftExpiry] = useState('')
  const [draftSource, setDraftSource] = useState('')

  useEffect(() => {
    try { localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(rows)) } catch { /* quota */ }
  }, [rows])

  const visibleCoupons = useMemo(
    () => rows.filter((r) => r.active && r.type === activeTab),
    [rows, activeTab],
  )

  const groupedByPlace = useMemo(() => {
    const order: string[] = []
    const map: Record<string, CouponRecord[]> = {}
    for (const c of visibleCoupons) {
      if (!map[c.place]) { order.push(c.place); map[c.place] = [] }
      map[c.place].push(c)
    }
    return order.map((place) => ({ place, coupons: map[place] }))
  }, [visibleCoupons])

  function resetDraft() {
    setDraftPlace(''); setDraftType('grocery'); setDraftDesc('')
    setDraftDiscount(''); setDraftCode(''); setDraftExpiry(''); setDraftSource('')
  }

  function handleAdd() {
    const place = draftPlace.trim()
    const desc = draftDesc.trim()
    const discount = draftDiscount.trim()
    if (!place || !desc || !discount) {
      setError('Place, description, and discount are required.')
      return
    }
    setError('')
    const newEntry: CouponRecord = {
      coupon_id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      place, type: draftType, description: desc, discount,
      code: draftCode || undefined,
      expiry_date: draftExpiry || undefined,
      source: draftSource || undefined,
      active: true,
    }
    setRows((prev) => [...prev, newEntry])
    resetDraft()
    setShowAddForm(false)
  }

  function handleDelete(couponId: string) {
    setRows((prev) => prev.filter((r) => r.coupon_id !== couponId))
  }

  const placeOptions = draftType === 'grocery'
    ? [...GROCERY_STORES, 'Other']
    : FAST_FOOD_PLACES

  return (
    <article className="info-card section-page-card sheets-card">
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          <button
            type="button"
            className={`section-edit-btn ${isEditing ? 'active' : ''}`}
            aria-pressed={isEditing}
            onClick={() => { setIsEditing((v) => !v); if (!isEditing) setIsCollapsed(false) }}
            title="Edit coupons"
          >✎</button>
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((v) => !v)}
          >{isCollapsed ? '▸' : '▾'}</button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          {rows.filter((r) => r.active).length === 0 && !isEditing ? (
            <p className="sheets-meta">{fallbackBody}</p>
          ) : null}

          <div className="deals-store-tabs">
            <button
              type="button"
              className={`deals-store-tab-btn ${activeTab === 'grocery' ? 'active' : ''}`}
              onClick={() => setActiveTab('grocery')}
            >Grocery Stores</button>
            <button
              type="button"
              className={`deals-store-tab-btn ${activeTab === 'fastfood' ? 'active' : ''}`}
              onClick={() => setActiveTab('fastfood')}
            >Fast Food</button>
          </div>

          {groupedByPlace.length === 0 && !isEditing ? (
            <p className="sheets-meta">No {activeTab === 'grocery' ? 'grocery store' : 'fast food'} coupons yet.</p>
          ) : null}

          {groupedByPlace.length > 0 ? (
            <div className="coupon-groups">
              {groupedByPlace.map(({ place, coupons }) => (
                <div key={place} className="coupon-place-section">
                  <h4 className="coupon-place-heading">{place}</h4>
                  <div className="coupon-list">
                    {coupons.map((c) => (
                      <div key={c.coupon_id} className="coupon-card">
                        <div className="coupon-card-top">
                          <span className="coupon-discount-badge">{c.discount}</span>
                          <span className="coupon-desc">{c.description}</span>
                          {isEditing ? (
                            <button
                              type="button"
                              className="deals-delete-btn"
                              onClick={() => handleDelete(c.coupon_id)}
                            >×</button>
                          ) : null}
                        </div>
                        <div className="coupon-card-meta">
                          {c.code ? <span className="coupon-code">Code: <strong>{c.code}</strong></span> : null}
                          {c.expiry_date ? <span className="coupon-expiry">Exp: {c.expiry_date}</span> : null}
                          {c.source ? <span className="coupon-source">{c.source}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {isEditing ? (
            <div className="deals-add-section">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setShowAddForm((v) => !v)}
              >{showAddForm ? 'Cancel' : '+ Add Coupon'}</button>

              {showAddForm ? (
                <div className="deals-add-form">
                  <div className="deals-form-row">
                    <select className="sheets-input" value={draftType} onChange={(e) => { setDraftType(e.target.value as 'grocery' | 'fastfood'); setDraftPlace('') }}>
                      <option value="grocery">Grocery Store</option>
                      <option value="fastfood">Fast Food</option>
                    </select>
                    <select className="sheets-input" value={draftPlace} onChange={(e) => setDraftPlace(e.target.value)}>
                      <option value="">Select place *</option>
                      {placeOptions.map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <input className="sheets-input" placeholder="Discount (e.g. $5 off, BOGO) *" value={draftDiscount} onChange={(e) => setDraftDiscount(e.target.value)} />
                  </div>
                  <div className="deals-form-row">
                    <input className="sheets-input" placeholder="Description *" value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} />
                    <input className="sheets-input" placeholder="Promo code (optional)" value={draftCode} onChange={(e) => setDraftCode(e.target.value)} />
                  </div>
                  <div className="deals-form-row">
                    <input className="sheets-input" placeholder="Expiry date" value={draftExpiry} onChange={(e) => setDraftExpiry(e.target.value)} />
                    <input className="sheets-input" placeholder="Source (App, Email, Website...)" value={draftSource} onChange={(e) => setDraftSource(e.target.value)} />
                    <button type="button" className="primary-action" onClick={handleAdd}>Save</button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="sheets-error">{error}</p> : null}
        </>
      ) : null}
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

        if (path === '/cooking/recipes' && card.title === 'Recipes') {
          const googleEmail = getGoogleTokenEmail(googleIdToken)
          const canWrite = profile === 'admin' && shouldUseAdminProfile(googleEmail)

          return (
            <RecipesCard
              key={card.title}
              title={card.title}
              canWrite={canWrite}
              idToken={googleIdToken}
            />
          )
        }

        if (path === '/cooking/recipes' && card.title === 'Randomizer') {
          return <RecipeRandomizerCard key={card.title} title={card.title} />
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

        if (path === '/cooking/deals' && card.title === 'Cost Analysis') {
          return (
            <GroceryPriceCard
              key={card.title}
              title={card.title}
              fallbackBody={card.body}
            />
          )
        }

        if (path === '/cooking/deals' && card.title === 'Store Deals') {
          return (
            <StoreDealsCard
              key={card.title}
              title={card.title}
              fallbackBody={card.body}
            />
          )
        }

        if (path === '/cooking/deals' && card.title === 'Coupons') {
          return (
            <CouponsCard
              key={card.title}
              title={card.title}
              fallbackBody={card.body}
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

// ── Gaming ────────────────────────────────────────────────────────────────

const MC_DOC_URL = 'https://docs.google.com/document/d/1yUUUDR1jYHLBj_nu-0Rqnf9_e5c3vfgSlqXv8i2Eegw/edit?tab=t.0'

type McServerStatus = { online: boolean; players?: { online: number; max: number }; version?: string }

function GamingServerPage() {
  const [playerName, setPlayerName] = useState('')
  const [status,     setStatus]     = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg,   setErrorMsg]   = useState('')
  const [autoStarted, setAutoStarted] = useState(false)

  const [srvStatus,      setSrvStatus]      = useState<McServerStatus | null>(null)
  const [srvChecking,    setSrvChecking]    = useState(true)
  const [srvLastChecked, setSrvLastChecked] = useState<Date | null>(null)

  async function checkServerStatus() {
    setSrvChecking(true)
    try {
      const res  = await fetch('https://api.mcsrvstat.us/3/pasionabe.aternos.me')
      const data = await res.json()
      setSrvStatus({ online: !!data.online, players: data.players, version: data.version })
    } catch {
      setSrvStatus({ online: false })
    } finally {
      setSrvChecking(false)
      setSrvLastChecked(new Date())
    }
  }

  useEffect(() => { checkServerStatus() }, [])

  async function handleStart() {
    const name = playerName.trim()
    if (!name) return
    setStatus('loading')
    setErrorMsg('')
    try {
      const result = await logMcServerStart(name)
      setAutoStarted(result.serverStarted)
      setStatus('success')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong')
      setStatus('error')
    }
  }

  return (
    <PageFrame
      eyebrow="Minecraft"
      title="Server"
      summary="Start the Aternos server and get connection instructions."
      accent="#7e22ce"
      backLink="/gaming"
      backLabel="Back to Gaming"
      note=""
    >
      {/* ── Server Status ── */}
      <div className="info-card section-page-card mc-srvstatus-card">
        <div className="mc-srvstatus-header">
          <h3>Server Status</h3>
          <button
            className="mc-refresh-btn"
            onClick={checkServerStatus}
            disabled={srvChecking}
            title="Refresh status"
          >
            {srvChecking ? '…' : '↺ Refresh'}
          </button>
        </div>

        {srvChecking && !srvStatus ? (
          <p className="mc-card-body">Checking server…</p>
        ) : srvStatus ? (
          <div className="mc-srvstatus-body">
            <div className={`mc-srv-badge ${srvStatus.online ? 'mc-srv-badge--on' : 'mc-srv-badge--off'}`}>
              <span className="mc-srv-dot" />
              {srvStatus.online ? 'Online' : 'Offline'}
            </div>
            {srvStatus.online && srvStatus.players != null && (
              <span className="mc-srv-players">{srvStatus.players.online} / {srvStatus.players.max} players</span>
            )}
            {srvStatus.version && (
              <span className="mc-srv-version">{srvStatus.version}</span>
            )}
          </div>
        ) : null}

        <p className="mc-card-body mc-srv-address">
          <code>pasionabe.aternos.me</code>
          {srvLastChecked && (
            <span className="mc-srv-checked"> · checked {srvLastChecked.toLocaleTimeString()}</span>
          )}
        </p>
      </div>

      {/* ── How to Connect ── */}
      <div className="info-card section-page-card mc-doc-card">
        <h3>How to Connect</h3>
        <p className="mc-card-body">Full connection instructions, server rules, and mods are in the guide below.</p>
        <a
          href={MC_DOC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="primary-action mc-doc-link"
        >
          Open Connection Guide
        </a>
      </div>

      {/* ── Start the Server ── */}
      <div className="info-card section-page-card mc-server-card">
        <h3>Start the Server</h3>
        <p className="mc-card-body">
          Enter your name and click <strong>Start Server</strong>. The server will start automatically
          and the owner will be notified. It may take up to 2 minutes to come online.
        </p>

        <div className="mc-start-form">
          <input
            type="text"
            className="mc-name-input"
            placeholder="Your name"
            value={playerName}
            onChange={e => {
              setPlayerName(e.target.value)
              if (status !== 'idle') { setStatus('idle'); setAutoStarted(false) }
            }}
            onKeyDown={e => { if (e.key === 'Enter') handleStart() }}
            disabled={status === 'loading' || status === 'success'}
            maxLength={40}
          />
          <button
            className="primary-action mc-start-btn"
            onClick={handleStart}
            disabled={!playerName.trim() || status === 'loading' || status === 'success'}
          >
            {status === 'loading' ? 'Starting…' : 'Start Server'}
          </button>
        </div>

        {status === 'success' && (
          <p className="mc-status mc-status--ok">
            {autoStarted
              ? `Server is starting, ${playerName}! Give it 1–2 minutes to come online.`
              : `Request logged, ${playerName}! The owner has been notified and will start the server shortly.`}
          </p>
        )}
        {status === 'error' && (
          <p className="mc-status mc-status--err">{errorMsg}</p>
        )}
      </div>
    </PageFrame>
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

export default App
