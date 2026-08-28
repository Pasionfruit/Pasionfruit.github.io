import React, { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  BookOpen,
  Briefcase,
  Check,
  ExternalLink,
  House,
  List,
  NotebookPen,
  Pencil,
  RotateCcw,
  SquareCheck,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
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
import { useRouteMeta } from './routeMeta'
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
import './admin/admin.css'
import { sounds } from './sounds'
import { DEV_SIGN_IN_ACCOUNTS, makeDevIdToken } from './devAuth'
import { HomeHero } from './components/HomeHero'
import { PageFrame, SummaryText } from './components/PageFrame'
import { TasksPage } from './tasks/TasksPage'
import { WeatherCard } from './weather/WeatherCard'
import { AdminPage } from './admin/AdminPage'
import { CalendarWeekCard } from './admin/CalendarWeekCard'
import { GarminWellnessCard } from './admin/GarminCards'
import { GmailSummaryCard } from './admin/GmailSummaryCard'
import { JournalDashboard } from './admin/JournalDashboard'
import { WorkDashboard } from './admin/WorkDashboard'
import { YesterdayRecapCard } from './admin/YesterdayRecapCard'
import { dueDateKey, formatDayLabel, isOverdue } from './data/todoist/dates'
import {
  adminDashboards,
  adminDashboardsById,
  educationEntries,
  navSections,
  personalSiteEntries,
  professionalExperienceEntries,
  sectionPages,
  type AdminIconId,
  type EducationEntry,
  type PersonalSiteEntry,
  type ProfessionalExperienceEntry,
  type SectionId,
} from './siteContent'
import {
  getAbeTransactions,
  getCiaraTransactions,
  createEvent,
  deleteEvent,
  getCurrentStudy,
  getEvents,
  getPersonalTraining,
  getGarminHealth,
  getRingconnHealth,
  getAppleHealth,
  getTrainingRecords,
  setActiveEvent,
  setCurrentStudyCompleted,
  setTrainingWorkoutCompleted,
  updateEvent,
  upsertTrainingRecord,
  replaceCurrentStudyForDate,
  getBudgetTargets,
  saveBudgetTarget,
  type BudgetTargetRecord,
  getTrips,
  createTrip,
  updateTrip,
  deleteTrip,
} from './data/sheets/repositories'
import type {
  AppleHealthRecord,
  CurrentStudyRecord,
  EventRecord,
  FinanceTransactionRecord,
  GarminHealthRecord,
  PersonalTrainingRecord,
  RingconnHealthRecord,
  TrainingRecord,
  TripRecord,
} from './data/sheets/types'
import { warmupAppsScript } from './data/sheets/client'
import { closeTask, getTasksOfTheDay } from './data/todoist/repositories'
import type { TodoistTask } from './data/todoist/types'
import { getServerStatus, startServer } from './minecraft/api'

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
  const isAdmin = profile === 'admin' && shouldUseAdminProfile(googleEmail)

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
        <Route element={<SiteLayout isAdmin={isAdmin} googleIdToken={googleIdToken} />}>
          <Route
            index
            element={
              isAdmin ? (
                <AdminHomePage profile={profile} googleIdToken={googleIdToken} />
              ) : (
                <HomePage />
              )
            }
          />
          <Route
            path="login"
            element={(
              <LoginPage
                profile={profile}
                googleIdToken={googleIdToken}
                onGoogleTokenChange={setGoogleIdToken}
              />
            )}
          />

          {/* The public sections live on the home page now; old URLs keep working
              by landing on the matching anchor. */}
          <Route path="experiences" element={<Navigate replace to="/#experiences" />} />
          <Route path="experiences/studying" element={<Navigate replace to="/#experiences" />} />
          <Route path="experience/studying" element={<Navigate replace to="/#experiences" />} />
          <Route path="personal-sites" element={<Navigate replace to="/#personal-sites" />} />
          <Route path="gaming" element={<Navigate replace to="/#gaming" />} />
          <Route path="gaming/server" element={<Navigate replace to="/#gaming" />} />

          {/* Private dashboards */}
          <Route path="admin" element={<AdminGate isAdmin={isAdmin} />}>
            {/* Home is the daily dashboard now, so the old hub and the pages that
                merged into it all land back on `/`. */}
            <Route index element={<Navigate replace to="/" />} />
            <Route path="tasks" element={<Navigate replace to="/" />} />
            <Route path="calendar" element={<Navigate replace to="/" />} />
            <Route
              path="personal"
              element={<JournalDashboard canWrite={isAdmin} idToken={googleIdToken} />}
            />
            <Route path="journal" element={<Navigate replace to="/admin/personal" />} />
            <Route
              path="finance"
              element={
                canViewPrivateFinances ? (
                  <AdminFinancePage googleIdToken={googleIdToken} />
                ) : (
                  <Navigate replace to="/admin" />
                )
              }
            />
            <Route
              path="health"
              element={<AdminHealthPage profile={profile} googleIdToken={googleIdToken} />}
            />
            <Route path="training" element={<Navigate replace to="/admin/health" />} />
            <Route path="work" element={<WorkDashboard canWrite={isAdmin} idToken={googleIdToken} />} />
          </Route>

          <Route
            path="tasks"
            element={
              isAdmin ? (
                <TasksPage
                  canEdit={getGoogleTokenEmail(googleIdToken) === TODOIST_EDITOR_EMAIL}
                  configured={isTodoistConfigured()}
                />
              ) : (
                <Navigate replace to="/" />
              )
            }
          />
          <Route
            path="weekly-reset"
            element={
              isAdmin ? (
                <WeeklyResetPage profile={profile} googleIdToken={googleIdToken} />
              ) : (
                <Navigate replace to="/" />
              )
            }
          />

          {/* Sections that moved or were retired. */}
          <Route path="finances" element={<Navigate replace to="/admin/finance" />} />
          <Route path="mrpasionfruit/finances" element={<Navigate replace to="/admin/finance" />} />
          <Route path="training" element={<Navigate replace to="/admin/health" />} />
          <Route path="training/*" element={<Navigate replace to="/admin/health" />} />
          <Route path="mrpasionfruit" element={<Navigate replace to="/" />} />
          <Route path="mrpasionfruit/*" element={<Navigate replace to="/" />} />
          <Route path="cooking" element={<Navigate replace to="/#personal-sites" />} />
          <Route path="cooking/*" element={<Navigate replace to="/#personal-sites" />} />

          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
      </Routes>
    </>
  )
}

/**
 * Everything under /admin is admin-only. Guests are bounced to the public home
 * page rather than shown a login prompt — the dashboards are not advertised.
 */
function AdminGate({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) {
    return <Navigate replace to="/" />
  }

  return <Outlet />
}

/**
 * What the admin sees at `/` instead of the public sections: today's tasks, a
 * recap of yesterday, the inbox, and the week's calendar.
 */
function AdminHomePage({ profile, googleIdToken }: { profile: UserProfile; googleIdToken: string }) {
  return (
    <div className="admin-page admin-home">
      <CalendarWeekCard title="Month View" idToken={googleIdToken} />

      {/* Reuses the public home-top-row layout: equal columns and a fixed height
          on desktop, so switching tabs inside the tasks card cannot resize the row. */}
      <div className="home-top-row">
        <TodoistTasksCard title="Tasks of the Day" profile={profile} googleIdToken={googleIdToken} />
        <WeatherCard />
      </div>

      <div className="admin-home-split">
        <YesterdayRecapCard title="Yesterday" configured={isTodoistConfigured()} />
        <GmailSummaryCard title="Inbox" idToken={googleIdToken} />
      </div>

      <div className="admin-home-links">
        <Link to="/tasks" className="admin-quick-link">
          <List size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Full task manager</span>
        </Link>
        <Link to="/weekly-reset" className="admin-quick-link">
          <RotateCcw size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Weekly reset</span>
        </Link>
      </div>
    </div>
  )
}

function AdminFinancePage({ googleIdToken }: { googleIdToken: string }) {
  return (
    <AdminPage meta={adminDashboardsById.finance}>
      <FinancesHubCard idToken={googleIdToken} />
    </AdminPage>
  )
}

/**
 * The training dashboard folds in what used to be spread across /training,
 * /training/records, and /training/data — the wearable data is the point, so
 * it leads.
 */
function AdminHealthPage({ profile, googleIdToken }: { profile: UserProfile; googleIdToken: string }) {
  const canWrite = profile === 'admin' && getGoogleTokenEmail(googleIdToken) === TODOIST_EDITOR_EMAIL

  return (
    <AdminPage meta={adminDashboardsById.health}>
      <NextEventCountdownCard title="Next Event Countdown" canWrite={canWrite} idToken={googleIdToken} />
      <GarminWellnessCard title="Daily wellness" />
      <HealthDataCard title="Health Data" />
      <TrainingLogCard title="Training Log" canWrite={false} idToken={googleIdToken} />
      <MilestonesCard title="Milestones" />
    </AdminPage>
  )
}

/** Minimal line icons for the admin top bar, keyed off AdminDashboardMeta.icon. */
const ADMIN_NAV_ICONS: Record<AdminIconId, LucideIcon> = {
  home: House,
  personal: NotebookPen,
  finance: Wallet,
  health: Activity,
  work: Briefcase,
}

function AdminNav() {
  return (
    <nav className="admin-nav" aria-label="Dashboards">
      {adminDashboards.map((dashboard) => {
        const Icon = ADMIN_NAV_ICONS[dashboard.icon]

        return (
          <NavLink
            key={dashboard.id}
            to={dashboard.path}
            end={dashboard.path === '/'}
            className={({ isActive }) => `admin-nav-link ${isActive ? 'active' : ''}`}
            title={dashboard.title}
          >
            <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
            <span>{dashboard.title}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}

const EMAIL_INITIALS: Record<string, string> = {
  'pasionabe@gmail.com': 'AP',
  'pixielee1000@gmail.com': 'CL',
}

function SiteLayout({
  isAdmin,
  googleIdToken,
}: {
  isAdmin: boolean
  googleIdToken: string
}) {
  const googleEmail = getGoogleTokenEmail(googleIdToken)
  const brandMark = EMAIL_INITIALS[googleEmail] ?? 'PF'
  const brandName = googleEmail.split('@')[0] || 'Pasionfruit'
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>(() => getInitialTheme())
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  const location = useLocation()

  useRouteMeta(location.pathname)

  useEffect(() => {
    setMenuOpen(false)
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

  return (
    <div className="app-shell">
      <header className={`topbar ${isAdmin ? 'topbar-admin' : ''}`}>
        <Link to="/" className="brand" aria-label="Go to home page">
          <span className="brand-mark">{brandMark}</span>
          <span className="brand-copy">
            <strong>{brandName}</strong>
            <small>Living with Passion</small>
          </span>
        </Link>

        {isAdmin ? <AdminNav /> : null}

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
          {/* Admins navigate with the icon bar; only guests get the section menu. */}
          {isAdmin ? null : (
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
          )}
        </div>
      </header>

      {!isOnline ? (
        <p className="connectivity-banner" role="status" aria-live="polite">
          You are offline. Cached pages may still work, but live updates and saves are unavailable.
        </p>
      ) : null}

      {/* Guests browse with the slide-out menu; admins use the icon bar instead. */}
      {isAdmin ? null : (
        <>
          <div className={`menu-backdrop ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />

          <aside id="site-menu" className={`menu-panel ${menuOpen ? 'open' : ''}`}>
            <div className="menu-panel-header">
              <p>Browse pages</p>
              <button type="button" className="menu-close" onClick={() => setMenuOpen(false)}>
                Close
              </button>
            </div>

            <nav className="menu-root" aria-label="Primary">
              {navSections.map((section) => (
                <div key={section.id} className="menu-section-card">
                  <div className="menu-section-row">
                    <Link to={section.path} className="menu-main-link">
                      {section.title}
                    </Link>
                  </div>

                  <p className="menu-section-summary">{section.summary}</p>
                </div>
              ))}
            </nav>
          </aside>
        </>
      )}

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

/**
 * One collapsible block on the home page. Open state is lifted to HomePage so a
 * `#section` link from the menu can expand the right one before scrolling to it.
 */
function HomeSection({
  id,
  isOpen,
  onToggle,
  downloadPdfHref,
  downloadWordHref,
  children,
}: {
  id: SectionId
  isOpen: boolean
  onToggle: () => void
  downloadPdfHref?: string
  downloadWordHref?: string
  children: ReactNode
}) {
  const section = sectionPages[id]
  const headingId = `${id}-heading`

  return (
    <section
      id={id}
      className="home-section"
      style={{ '--page-accent': section.accent } as CSSProperties}
      aria-labelledby={headingId}
    >
      <div className="home-section-header">
        <button
          type="button"
          className="home-section-toggle"
          aria-expanded={isOpen}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
        >
          <span className="home-section-caret" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
          <span className="home-section-titles">
            <span className="eyebrow">{section.eyebrow}</span>
            <span id={headingId} className="home-section-title">{section.title}</span>
          </span>
        </button>

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

      <div id={`${id}-panel`} className="home-section-panel" hidden={!isOpen}>
        <SummaryText summary={section.summary} />
        {section.callout ? <p className="page-note">{section.callout}</p> : null}
        <div className="page-grid">{children}</div>
      </div>
    </section>
  )
}

const ALL_SECTION_IDS: SectionId[] = ['experiences', 'personal-sites', 'gaming']

/** The public home page: three collapsible sections. Admins get AdminHomePage. */
function HomePage() {
  const location = useLocation()
  /*
   * Experiences opens by default — it is the resume, and the reason most
   * visitors are here. The other two stay collapsed so the page stays scannable.
   */
  const [openSections, setOpenSections] = useState<SectionId[]>(['experiences'])

  const requestedSection = ALL_SECTION_IDS.find(
    (id) => id === location.hash.replace('#', ''),
  )

  // A /#gaming link from the menu expands that section and scrolls to it.
  useEffect(() => {
    if (!requestedSection) {
      return
    }

    setOpenSections((previous) =>
      previous.includes(requestedSection) ? previous : [...previous, requestedSection],
    )
    document.getElementById(requestedSection)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [requestedSection])

  function toggleSection(id: SectionId) {
    const isOpen = openSections.includes(id)
    if (isOpen) {
      sounds.sectionCollapse()
    } else {
      sounds.sectionExpand()
    }

    setOpenSections((previous) =>
      isOpen ? previous.filter((value) => value !== id) : [...previous, id],
    )
  }

  return (
    <div className="page home-page">
      <HomeHero />

      {/* Résumé downloads live in the hero now, not on the section header. */}
      <HomeSection
        id="experiences"
        isOpen={openSections.includes('experiences')}
        onToggle={() => toggleSection('experiences')}
      >
        {sectionPages.experiences.cards.map((card) => {
          if (card.title === 'Education') {
            return <EducationCard key={card.title} title={card.title} />
          }

          if (card.title === 'Professional Experience') {
            return <ProfessionalExperienceCard key={card.title} title={card.title} />
          }

          if (card.title === 'Technical Skills') {
            return <TechnicalSkillsCard key={card.title} title={card.title} body={card.body} />
          }

          return (
            <article key={card.title} className="info-card section-page-card">
              <h3>{card.title}</h3>
              <p>{card.body}</p>
            </article>
          )
        })}
      </HomeSection>

      <HomeSection
        id="personal-sites"
        isOpen={openSections.includes('personal-sites')}
        onToggle={() => toggleSection('personal-sites')}
      >
        {personalSiteEntries.map((entry) => (
          <PersonalSiteCard key={entry.url} entry={entry} />
        ))}
      </HomeSection>

      <HomeSection
        id="gaming"
        isOpen={openSections.includes('gaming')}
        onToggle={() => toggleSection('gaming')}
      >
        <MinecraftServerCards />
      </HomeSection>
    </div>
  )
}

function normalizePriority(value: number) {
  if (!Number.isFinite(value)) {
    return 1
  }

  return Math.min(4, Math.max(1, Math.round(value)))
}


/** Rows shown on the home summary card before it collapses to a "+N more" line. */
const SUMMARY_TASK_LIMIT = 8


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
  const canWrite = canEditTodoist
  const canViewOriginalTabs = shouldUseAdminProfile(googleEmail)
  const [view, setView] = useState<'studying' | 'training' | 'todoist'>(
    canViewOriginalTabs ? 'todoist' : 'studying',
  )
  const [rows, setRows] = useState<TodoistTask[]>([])
  const [trainingRows, setTrainingRows] = useState<TrainingRecord[]>([])
  const [studyRows, setStudyRows] = useState<CurrentStudyRecord[]>([])
  const [isDailyLoading, setIsDailyLoading] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')

  const todayKey = toDateOnlyKey(new Date().toISOString())

  const todaysTrainingRecord = useMemo(
    () => trainingRows.find((row) => toDateOnlyKey(row.date) === todayKey),
    [trainingRows, todayKey],
  )

  const todaysLessons = useMemo(() => {
    return studyRows
      .filter((row) => toDateOnlyKey(row.date) === todayKey && row.topic.trim().length > 0)
      .sort((a, b) => a.topic.localeCompare(b.topic))
  }, [studyRows, todayKey])

  const summaryOverdueCount = useMemo(() => rows.filter((row) => isOverdue(row)).length, [rows])
  const summaryTodayCount = rows.length - summaryOverdueCount

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
    void loadDailyData()

    if (!todoistConfigured) {
      setRows([])
      setIsLoading(false)
      return
    }

    void loadTasks()
  }, [])

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

  return (
    <article className={`info-card home-todoist-card sheets-card${isCollapsed ? ' is-collapsed' : ''}`}>
      <div className="section-card-header">
        <h3>{title}</h3>
        <div className="section-card-actions">
          <button
            type="button"
            className="section-collapse-btn home-todoist-collapse-btn"
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            {isCollapsed ? '▸' : '▾'}
          </button>
        </div>
      </div>

      <div className="home-todoist-collapsible">
          <div className="experience-toggle" role="tablist" aria-label="Tasks of the Day filter">
            {canViewOriginalTabs ? (
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
                            {todaysTrainingRecord.completed_morning ? <><Check size={13} aria-hidden="true" /> Completed</> : 'Mark Complete'}
                          </button>
                        ) : (
                          <span>{todaysTrainingRecord.completed_morning ? <><Check size={12} aria-hidden="true" /> Yes</> : 'No'}</span>
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
                            {todaysTrainingRecord.completed_evening ? <><Check size={13} aria-hidden="true" /> Completed</> : 'Mark Complete'}
                          </button>
                        ) : (
                          <span>{todaysTrainingRecord.completed_evening ? <><Check size={12} aria-hidden="true" /> Yes</> : 'No'}</span>
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
                              {row.completed ? <><Check size={13} aria-hidden="true" /> Completed</> : 'Mark Complete'}
                            </button>
                          ) : row.completed ? (
                            <Check size={14} aria-hidden="true" />
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
            <p className="sheets-meta">Edit access restricted to admin.</p>
          ) : null}

          {view === 'todoist' && !todoistConfigured ? (
            <p className="sheets-error">Set VITE_TODOIST_API_TOKEN in your .env file, then restart the app.</p>
          ) : null}

          {view === 'todoist' && todoistConfigured && isLoading ? <p className="sheets-meta">Loading Todoist tasks...</p> : null}

          {view === 'todoist' && !canEditTodoist ? (
            <p className="sheets-meta">
              Edit access restricted to admin.
            </p>
          ) : null}

          {view === 'todoist' && todoistConfigured && !isLoading ? (
            <div className="todoist-summary">
              <p className="sheets-meta">
                {summaryOverdueCount > 0 ? (
                  <span className="todoist-summary-alert">{summaryOverdueCount} overdue</span>
                ) : null}
                {summaryOverdueCount > 0 ? ' · ' : ''}
                {summaryTodayCount} due today
              </p>

              {rows.length > 0 ? (
                <div className="todoist-task-list">
                  {rows.slice(0, SUMMARY_TASK_LIMIT).map((row) => (
                    <div
                      key={`summary-${row.id}`}
                      className={`todoist-task-row${row.is_completed ? ' is-completed' : ''}`}
                      data-priority={normalizePriority(row.priority)}
                    >
                      <button
                        type="button"
                        className="todoist-complete-btn"
                        data-priority={normalizePriority(row.priority)}
                        onClick={() => void handleCompleteTask(row)}
                        disabled={isWriting || row.is_completed || !canEditTodoist}
                        title={canEditTodoist ? 'Mark complete' : undefined}
                        aria-label={`Complete: ${row.content}`}
                      />
                      <div className="todoist-task-content">
                        <p className={row.is_completed ? 'todoist-task-done' : ''}>{row.content}</p>
                      </div>
                      {isOverdue(row) ? (
                        <p className="todoist-summary-overdue">{formatDayLabel(dueDateKey(row))}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="sheets-meta">No tasks due today or overdue.</p>
              )}

              {rows.length > SUMMARY_TASK_LIMIT ? (
                <p className="sheets-meta">+{rows.length - SUMMARY_TASK_LIMIT} more</p>
              ) : null}

              <Link to="/tasks" className="todoist-summary-link">
                Open all tasks →
              </Link>
            </div>
          ) : null}

          {view === 'todoist' && todoistConfigured && !isLoading && rows.length === 0 && !canEditTodoist && !writeError ? (
            <p className="sheets-meta">No tasks due today or overdue.</p>
          ) : null}

          {writeError ? <p className="sheets-error">{writeError}</p> : null}
      </div>
    </article>
  )
}

const STATUS_LABELS: Record<PersonalSiteEntry['status'], string> = {
  live: 'Live',
  'in-progress': 'In progress',
  archived: 'Archived',
}

function PersonalSiteCard({ entry }: { entry: PersonalSiteEntry }) {
  return (
    <article className="info-card project-card">
      <div className="project-card-head">
        <div className="project-card-title">
          {/* Decorative: the name beside it already identifies the project. */}
          {entry.logo ? (
            <img
              className="project-logo"
              src={entry.logo}
              alt=""
              width={192}
              height={192}
              loading="lazy"
              decoding="async"
            />
          ) : null}
          <h3>{entry.name}</h3>
        </div>
        <span className="admin-pill">{STATUS_LABELS[entry.status]}</span>
      </div>

      <p className="project-tagline">{entry.tagline}</p>
      <p>{entry.description}</p>

      <div className="project-stack">
        {entry.stack.map((tool) => (
          <span key={tool} className="project-chip">
            {tool}
          </span>
        ))}
      </div>

      <a href={entry.url} target="_blank" rel="noreferrer" className="project-visit">
        <ExternalLink size={15} strokeWidth={1.8} aria-hidden="true" />
        <span>Try it</span>
      </a>
    </article>
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
                      <X size={14} aria-hidden="true" />
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

function CollapsibleSectionCard({
  title,
  className = '',
  defaultCollapsed = false,
  children,
}: {
  title: string
  className?: string
  defaultCollapsed?: boolean
  children: ReactNode
}) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

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
    <CollapsibleSectionCard title={title} className="technical-skills-card" defaultCollapsed>
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

  // Date-only strings have to be read in local time, or every one displays a
  // day early west of UTC.
  const parsedDate = parseTrainingDate(value)
  if (!parsedDate) {
    return value
  }

  return parsedDate.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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

  /*
   * A bare 'YYYY-MM-DD' is parsed by `new Date()` as UTC midnight, which in any
   * negative-offset zone lands on the previous day locally — putting every
   * contribution tile one day early, in the wrong weekday column. Date-only
   * strings are calendar dates, so build them in local time.
   */
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
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

/**
 * Collapse Garmin activity rows into one record per day so the contribution
 * grid can render them unchanged.
 *
 * Garmin is the source of truth now — a day counts because an activity was
 * actually recorded, not because a box was ticked. The completed flags are
 * therefore derived, and the card is rendered read-only.
 */
function garminToTrainingRows(rows: GarminHealthRecord[]): TrainingRecord[] {
  const byDay = new Map<string, GarminHealthRecord[]>()

  for (const row of rows) {
    const key = String(row.date ?? '').slice(0, 10)
    if (!key) continue
    byDay.set(key, [...(byDay.get(key) ?? []), row])
  }

  const describe = (row: GarminHealthRecord) => {
    const name = (row.title || row.activity_type || 'Activity').trim()
    const minutes = Number(row.duration_min)
    return Number.isFinite(minutes) && minutes > 0 ? `${name} · ${Math.round(minutes)} min` : name
  }

  return [...byDay.entries()].map(([date, dayRows]) => ({
    training_id: date,
    date,
    morning_workout: dayRows[0] ? describe(dayRows[0]) : '',
    evening_workout: dayRows[1] ? describe(dayRows[1]) : '',
    completed_morning: dayRows.length >= 1,
    completed_evening: dayRows.length >= 2,
  }))
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
        const data = await getGarminHealth()
        if (isMounted) {
          setRows(garminToTrainingRows(data))
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
    const year = Number(yearFilter)
    const byDate = new Map<string, TrainingRecord>()

    for (const row of filteredRows) {
      const key = toDateOnlyKey(row.date)
      if (key) {
        byDate.set(key, row)
      }
    }

    const now = new Date()
    const isCurrentYear = year === now.getFullYear()

    return MONTH_LABELS.map((label, monthIndex) => {
      // How many empty Mon-anchored cells precede day 1 (Mon=0 … Sun=6)
      const firstDayOffset = (new Date(year, monthIndex, 1).getDay() + 6) % 7
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()

      // Days beyond today have not happened yet, so they get no tile at all.
      const lastDay =
        isCurrentYear && monthIndex > now.getMonth()
          ? 0
          : isCurrentYear && monthIndex === now.getMonth()
            ? now.getDate()
            : daysInMonth

      /*
       * One tile per day, whether or not anything was recorded. Garmin only
       * returns rows for days with an activity, so without this padding the
       * grid renders as scattered dots instead of a contribution calendar.
       */
      const rows: TrainingRecord[] = []
      for (let day = 1; day <= lastDay; day += 1) {
        const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        rows.push(
          byDate.get(key) ?? {
            training_id: key,
            date: key,
            morning_workout: '',
            evening_workout: '',
            completed_morning: false,
            completed_evening: false,
          },
        )
      }

      return { monthIndex, label, rows, firstDayOffset }
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
                  aria-label="Previous quarter"
                  onClick={() => setMobilePage((p) => Math.max(0, p - 1))}
                  disabled={mobilePage === 0}
                >
                  ‹
                </button>
                <span className="sheets-meta">{['Jan – Mar', 'Apr – Jun', 'Jul – Sep', 'Oct – Dec'][mobilePage]}</span>
                <button
                  type="button"
                  className="secondary-action"
                  aria-label="Next quarter"
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
                        /*
                         * Keyed by year as well as month so switching years
                         * remounts the column. Keyed by month alone, React
                         * reconciled the new year's days against the old ones
                         * and left the previous year's activity tiles behind.
                         */
                        key={`${yearFilter}-${group.monthIndex}`}
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
                          {group.rows.map((row, dayIndex) => {
                            const tileLevel = getTrainingTileLevel(row)
                            const activities = [row.morning_workout, row.evening_workout].filter(Boolean)
                            const label = activities.length
                              ? `${formatSheetDate(row.date)} — ${activities.join(', ')}`
                              : `${formatSheetDate(row.date)} — no activity`
                            const parsedDate = parseTrainingDate(row.date)
                            const gridColumn = parsedDate ? (parsedDate.getDay() + 6) % 7 + 1 : undefined
                            const gridRow = parsedDate
                              ? Math.floor((parsedDate.getDate() - 1 + group.firstDayOffset) / 7) + 1
                              : undefined

                            return (
                              <div
                                /*
                                 * Keyed by day slot, not by record id. The list
                                 * is one fixed slot per day of the month, and a
                                 * day's row swaps between a padded placeholder
                                 * and a real record — keying on the id made
                                 * React treat that as two different children
                                 * and leave both tiles in the grid.
                                 */
                                key={dayIndex}
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
                            {todaysRecord.completed_morning ? <><Check size={13} aria-hidden="true" /> Completed</> : 'Mark Complete'}
                          </button>
                        ) : (
                          <span>{todaysRecord.completed_morning ? <><Check size={12} aria-hidden="true" /> Yes</> : 'No'}</span>
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
                            {todaysRecord.completed_evening ? <><Check size={13} aria-hidden="true" /> Completed</> : 'Mark Complete'}
                          </button>
                        ) : (
                          <span>{todaysRecord.completed_evening ? <><Check size={12} aria-hidden="true" /> Yes</> : 'No'}</span>
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
                Edit access restricted to admin.
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
              <Pencil size={14} aria-hidden="true" />
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

function EducationCard({ title }: { title: string }) {
  return (
    <CollapsibleSectionCard title={title} className="experience-card" defaultCollapsed>
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
    <CollapsibleSectionCard title={title} className="experience-card" defaultCollapsed>
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
  const [isCollapsed, setIsCollapsed] = useState(true)

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

function toDateOnlyKey(value?: string) {
  if (!value) {
    return ''
  }

  /*
   * Must parse the same way the grid does. `new Date('2026-08-02')` is UTC
   * midnight, which in a negative-offset zone is the previous day locally — so
   * a record keyed here landed one slot earlier than the tile that rendered it,
   * leaving the real day padded and the record duplicated a day early.
   */
  const parsed = parseTrainingDate(value)
  if (!parsed) {
    return ''
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
}

Chart.register(CategoryScale, LinearScale, LineController, LineElement, PointElement, Filler, Tooltip, TimeScale)

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
          tension:              0,
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
  const [isCollapsed, setIsCollapsed] = useState(false)
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
    const hrv        = r30.length > 0
      ? hMean(r30.map(r => parseFloat(r.hrv)))
      : hMean(a30.map(r => parseFloat(r.hrv_sdnn)))

    const hrvTrend = trendDir(hMean(r7.map(r => parseFloat(r.hrv))), hMean(rP7.map(r => parseFloat(r.hrv))))

    const tiles: { label: string; value: string; trend: TrendDir }[] = [
      { label: 'Workouts / 30d', value: workouts > 0 ? String(workouts)           : '—', trend: 'flat' },
      { label: 'Avg Distance',   value: avgDist  > 0 ? `${avgDist.toFixed(1)} mi` : '—', trend: 'flat' },
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
      <div className="section-card-header">
        <h3>{title}</h3>
        <button
          type="button"
          className="section-collapse-btn"
          aria-expanded={!isCollapsed}
          aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
          onClick={() => setIsCollapsed((value) => !value)}
        >
          {isCollapsed ? '▸' : '▾'}
        </button>
      </div>

      {isCollapsed ? null : (
      <>

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
      </>
      )}
    </article>
  )
}

function getResetWeekDates() {
  // Saturday-through-Friday week containing today, matching the meal plan's day ordering.
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - ((start.getDay() + 1) % 7))

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start)
    date.setDate(start.getDate() + index)
    return date
  })
}

function toSheetDateString(date: Date) {
  // M/D/YYYY parses as local time everywhere the app reads sheet dates back.
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

function WeeklyResetPage({ profile, googleIdToken }: { profile: UserProfile; googleIdToken: string }) {
  const canWrite = profile === 'admin'

  return (
    <PageFrame
      eyebrow="Admin tools"
      title="Weekly Reset"
      summary="One place to set this week's workouts and study plan."
      accent="#f97316"
      backLink="/admin"
      backLabel="Back to dashboards"
      note=""
    >
      <WeeklyWorkoutResetCard title="Workouts for the Week" canWrite={canWrite} idToken={googleIdToken} />
      <WeeklyStudyResetCard title="Study Plan for the Week" canWrite={canWrite} idToken={googleIdToken} />
    </PageFrame>
  )
}

type WeeklyWorkoutDraft = { morning: string; evening: string }

// Default training split applied by "Reset week", keyed by Date.getDay() (0 = Sunday).
const WEEKLY_WORKOUT_DEFAULTS: Record<number, WeeklyWorkoutDraft> = {
  0: { morning: 'Rest: —', evening: 'Rest: —' },
  1: { morning: 'Chest & Tri', evening: 'Swim' },
  2: { morning: 'Sprints', evening: 'Back & Bi' },
  3: { morning: 'Bike', evening: 'Legs' },
  4: { morning: 'Progressive Run', evening: 'Back & Chest' },
  5: { morning: 'Arms', evening: 'Swim' },
  6: { morning: 'Easy Run', evening: 'Mobility' },
}

function WeeklyWorkoutResetCard({
  title,
  canWrite,
  idToken,
}: {
  title: string
  canWrite: boolean
  idToken: string
}) {
  const weekDates = useMemo(() => getResetWeekDates(), [])
  const [rows, setRows] = useState<TrainingRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [drafts, setDrafts] = useState<Record<string, WeeklyWorkoutDraft>>({})
  const [savedDrafts, setSavedDrafts] = useState<Record<string, WeeklyWorkoutDraft>>({})
  const [isExpanded, setIsExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  async function loadWeek() {
    try {
      const data = await getTrainingRecords()
      setRows(data)
    } catch {
      setRows([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadWeek()
  }, [])

  useEffect(() => {
    const byDate = new Map(rows.map((row) => [toDateOnlyKey(row.date), row]))
    const next: Record<string, WeeklyWorkoutDraft> = {}
    weekDates.forEach((date) => {
      const key = toDateOnlyKey(date.toISOString())
      const row = byDate.get(key)
      next[key] = { morning: row?.morning_workout ?? '', evening: row?.evening_workout ?? '' }
    })
    setDrafts(next)
    setSavedDrafts(next)
  }, [rows, weekDates])

  function setDraftValue(key: string, field: keyof WeeklyWorkoutDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { morning: '', evening: '' }), [field]: value },
    }))
  }

  function handleClearAll() {
    setDrafts(() => {
      const next: Record<string, WeeklyWorkoutDraft> = {}
      weekDates.forEach((date) => {
        const key = toDateOnlyKey(date.toISOString())
        next[key] = { ...WEEKLY_WORKOUT_DEFAULTS[date.getDay()] }
      })
      return next
    })
  }

  async function handleSaveAll() {
    if (!canWrite || !idToken || isWriting) return
    setIsWriting(true)
    setWriteError('')
    setSaveMessage('')
    try {
      const changedDates = weekDates.filter((date) => {
        const key = toDateOnlyKey(date.toISOString())
        const draft = drafts[key]
        const saved = savedDrafts[key]
        if (!draft) return false
        return (
          draft.morning.trim() !== (saved?.morning ?? '').trim() ||
          draft.evening.trim() !== (saved?.evening ?? '').trim()
        )
      })

      await Promise.all(
        changedDates.map((date) => {
          const draft = drafts[toDateOnlyKey(date.toISOString())]
          return upsertTrainingRecord(idToken, {
            date: toSheetDateString(date),
            morningWorkout: draft.morning.trim(),
            eveningWorkout: draft.evening.trim(),
          })
        }),
      )

      await loadWeek()
      setIsEditing(false)
      setSaveMessage(changedDates.length > 0 ? 'Workouts updated for this week.' : 'No workout changes to save.')
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to update workouts')
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
              title="Edit values"
              onClick={() => {
                if (isEditing) {
                  setDrafts(savedDrafts)
                  setIsEditing(false)
                } else {
                  setIsExpanded(true)
                  setIsEditing(true)
                }
              }}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((value) => !value)}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        </div>
      </div>

      {isLoading ? <p className="sheets-meta">Loading workouts...</p> : null}

      {!isLoading && isExpanded ? (
        <>
          <div className="sheets-table-shell">
            <table className="sheets-table weekly-reset-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Morning workout</th>
                  <th>Evening workout</th>
                </tr>
              </thead>
              <tbody>
                {weekDates.map((date) => {
                  const key = toDateOnlyKey(date.toISOString())
                  const draft = drafts[key] ?? { morning: '', evening: '' }
                  return (
                    <tr key={key}>
                      <td data-label="Day">
                        <span className="weekly-reset-day">
                          {date.toLocaleDateString('en-US', { weekday: 'long' })}
                        </span>
                        <span className="weekly-reset-date">
                          {date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                        </span>
                      </td>
                      <td data-label="Morning workout">
                        {isEditing ? (
                          <input
                            className="sheets-input sheets-table-input"
                            type="text"
                            value={draft.morning}
                            onChange={(event) => setDraftValue(key, 'morning', event.target.value)}
                            disabled={!canWrite || !idToken || isWriting}
                          />
                        ) : (
                          <span>{draft.morning || '—'}</span>
                        )}
                      </td>
                      <td data-label="Evening workout">
                        {isEditing ? (
                          <input
                            className="sheets-input sheets-table-input"
                            type="text"
                            value={draft.evening}
                            onChange={(event) => setDraftValue(key, 'evening', event.target.value)}
                            disabled={!canWrite || !idToken || isWriting}
                          />
                        ) : (
                          <span>{draft.evening || '—'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {isEditing ? (
            <div className="weekly-reset-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={handleClearAll}
                disabled={!canWrite || !idToken || isWriting}
              >
                Reset week
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => void handleSaveAll()}
                disabled={!canWrite || !idToken || isWriting}
              >
                {isWriting ? 'Saving...' : 'Save workouts'}
              </button>
            </div>
          ) : null}

          {canWrite && !idToken ? (
            <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
          ) : null}
          {saveMessage ? <p className="sheets-meta">{saveMessage}</p> : null}
          {writeError ? <p className="sheets-error">{writeError}</p> : null}
        </>
      ) : null}
    </article>
  )
}

type WeeklyStudyDraft = { relatedExam: string; topic: string }

function WeeklyStudyResetCard({
  title,
  canWrite,
  idToken,
}: {
  title: string
  canWrite: boolean
  idToken: string
}) {
  const weekDates = useMemo(() => getResetWeekDates(), [])
  const [rows, setRows] = useState<CurrentStudyRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [drafts, setDrafts] = useState<Record<string, WeeklyStudyDraft>>({})
  const [savedDrafts, setSavedDrafts] = useState<Record<string, WeeklyStudyDraft>>({})
  const [isExpanded, setIsExpanded] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  async function loadWeek() {
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
    void loadWeek()
  }, [])

  useEffect(() => {
    const next: Record<string, WeeklyStudyDraft> = {}
    weekDates.forEach((date) => {
      const key = toDateOnlyKey(date.toISOString())
      const row = rows.find((candidate) => toDateOnlyKey(candidate.date) === key)
      next[key] = { relatedExam: row?.related_exam ?? '', topic: row?.topic ?? '' }
    })
    setDrafts(next)
    setSavedDrafts(next)
  }, [rows, weekDates])

  function setDraftValue(key: string, field: keyof WeeklyStudyDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? { relatedExam: '', topic: '' }), [field]: value },
    }))
  }

  function handleClearAll() {
    setDrafts((current) => {
      const next: Record<string, WeeklyStudyDraft> = {}
      for (const key of Object.keys(current)) {
        next[key] = { relatedExam: '', topic: '' }
      }
      return next
    })
  }

  async function handleSaveAll() {
    if (!canWrite || !idToken || isWriting) return
    setIsWriting(true)
    setWriteError('')
    setSaveMessage('')
    try {
      const changedDates = weekDates.filter((date) => {
        const key = toDateOnlyKey(date.toISOString())
        const draft = drafts[key]
        const saved = savedDrafts[key]
        if (!draft) return false
        return (
          draft.relatedExam.trim() !== (saved?.relatedExam ?? '').trim() ||
          draft.topic.trim() !== (saved?.topic ?? '').trim()
        )
      })

      await Promise.all(
        changedDates.map((date) => {
          const draft = drafts[toDateOnlyKey(date.toISOString())]
          return replaceCurrentStudyForDate(idToken, {
            date: toSheetDateString(date),
            relatedExam: draft.relatedExam.trim(),
            topic: draft.topic.trim(),
          })
        }),
      )

      await loadWeek()
      setIsEditing(false)
      setSaveMessage(changedDates.length > 0 ? 'Study plan updated for this week.' : 'No study changes to save.')
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to update study plan')
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
              title="Edit values"
              onClick={() => {
                if (isEditing) {
                  setDrafts(savedDrafts)
                  setIsEditing(false)
                } else {
                  setIsExpanded(true)
                  setIsEditing(true)
                }
              }}
            >
              <Pencil size={14} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="section-collapse-btn"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((value) => !value)}
          >
            {isExpanded ? '▾' : '▸'}
          </button>
        </div>
      </div>

      {isLoading ? <p className="sheets-meta">Loading study plan...</p> : null}

      {!isLoading && isExpanded ? (
        <>
          <div className="sheets-table-shell">
            <table className="sheets-table weekly-reset-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Related exam</th>
                  <th>Topic</th>
                </tr>
              </thead>
              <tbody>
                {weekDates.map((date) => {
                  const key = toDateOnlyKey(date.toISOString())
                  const draft = drafts[key] ?? { relatedExam: '', topic: '' }
                  return (
                    <tr key={key}>
                      <td data-label="Day">
                        <span className="weekly-reset-day">
                          {date.toLocaleDateString('en-US', { weekday: 'long' })}
                        </span>
                        <span className="weekly-reset-date">
                          {date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                        </span>
                      </td>
                      <td data-label="Related exam">
                        {isEditing ? (
                          <input
                            className="sheets-input sheets-table-input"
                            type="text"
                            value={draft.relatedExam}
                            onChange={(event) => setDraftValue(key, 'relatedExam', event.target.value)}
                            disabled={!canWrite || !idToken || isWriting}
                          />
                        ) : (
                          <span>{draft.relatedExam || '—'}</span>
                        )}
                      </td>
                      <td data-label="Topic">
                        {isEditing ? (
                          <input
                            className="sheets-input sheets-table-input"
                            type="text"
                            value={draft.topic}
                            onChange={(event) => setDraftValue(key, 'topic', event.target.value)}
                            disabled={!canWrite || !idToken || isWriting}
                          />
                        ) : (
                          <span>{draft.topic || '—'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {isEditing ? (
            <div className="weekly-reset-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={handleClearAll}
                disabled={!canWrite || !idToken || isWriting}
              >
                Clear week
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => void handleSaveAll()}
                disabled={!canWrite || !idToken || isWriting}
              >
                {isWriting ? 'Saving...' : 'Save study plan'}
              </button>
            </div>
          ) : null}

          {isEditing ? (
            <p className="sheets-meta">
              Saving a day replaces all of that day's study rows; leave the topic empty to clear the day.
            </p>
          ) : null}
          {canWrite && !idToken ? (
            <p className="sheets-meta">Sign in with Google on Login page to submit admin writes.</p>
          ) : null}
          {saveMessage ? <p className="sheets-meta">{saveMessage}</p> : null}
          {writeError ? <p className="sheets-error">{writeError}</p> : null}
        </>
      ) : null}
    </article>
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
  googleIdToken,
  onGoogleTokenChange,
}: {
  profile: UserProfile
  googleIdToken: string
  onGoogleTokenChange: (token: string) => void
}) {
  const navigate = useNavigate()

  function handleGoogleSuccess(response: CredentialResponse) {
    const token = response.credential ?? ''
    if (token) {
      // App derives the profile from the token; land admins straight on the dashboards.
      onGoogleTokenChange(token)
      navigate(shouldUseAdminProfile(getGoogleTokenEmail(token)) ? '/admin' : '/')
    }
  }

  return (
    <section className="page auth-page">
      <PageFrame
        eyebrow="Access"
        title="Login"
        summary="Sign in with Google. The admin account unlocks the private dashboards; everyone else sees the public site."
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

          {/*
            Dev-only shortcut so the private dashboards can be opened without
            configuring OAuth. `import.meta.env.DEV` is replaced with `false`
            at build time, so none of this reaches production. The token is
            unsigned and unlocks the UI only — Apps Script still rejects writes.
          */}
          {import.meta.env.DEV ? (
            <div
              style={{
                display: 'grid',
                gap: '0.5rem',
                marginTop: '0.9rem',
                padding: '0.8rem',
                border: '1px dashed var(--border-strong)',
                borderRadius: '0.6rem',
                background: 'var(--surface-muted)',
              }}
            >
              <p className="summary-line">Local dev sign-in</p>
              <p className="sheets-meta">
                Skips Google OAuth. Grants dashboard access in this browser only —
                saves are still rejected by the backend.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                {DEV_SIGN_IN_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      const token = makeDevIdToken(account.email)
                      onGoogleTokenChange(token)
                      navigate(shouldUseAdminProfile(account.email) ? '/admin' : '/')
                    }}
                  >
                    {account.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </PageFrame>
    </section>
  )
}

const MC_DOC_URL    = 'https://docs.google.com/document/d/1yUUUDR1jYHLBj_nu-0Rqnf9_e5c3vfgSlqXv8i2Eegw/edit?tab=t.0'

type McServerStatus = { online: boolean; players?: { online: number; max: number }; version?: string }

/**
 * The Gaming section of the home page: how to connect, plus live server status
 * with a link into the control dashboard.
 */
/** Seconds the Start button stays locked after a press. */
const START_COOLDOWN_SECONDS = 60

function MinecraftServerCards() {
  const [srvStatus,      setSrvStatus]      = useState<McServerStatus | null>(null)
  const [srvChecking,    setSrvChecking]    = useState(true)
  const [srvLastChecked, setSrvLastChecked] = useState<Date | null>(null)
  const [isStarting,     setIsStarting]     = useState(false)
  const [cooldown,       setCooldown]       = useState(0)
  const [toast,          setToast]          = useState('')

  async function checkServerStatus() {
    setSrvChecking(true)
    try {
      const data = await getServerStatus()
      setSrvStatus({
        online: data.online,
        players:
          typeof data.players === 'number'
            ? { online: data.players, max: data.maxPlayers ?? 0 }
            : undefined,
        version: data.version,
      })
    } catch {
      setSrvStatus({ online: false })
    } finally {
      setSrvChecking(false)
      setSrvLastChecked(new Date())
    }
  }

  useEffect(() => {
    void checkServerStatus()
  }, [])

  // Tick the cooldown down once a second while it is running.
  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => window.clearTimeout(id)
  }, [cooldown])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(''), 4000)
    return () => window.clearTimeout(id)
  }, [toast])

  async function handleStart() {
    /*
     * nothing useful and can get the account throttled. The cooldown blocks
     * them, and pressing during it explains why rather than failing silently.
     */
    if (cooldown > 0) {
      setToast(`Already starting — give it ${cooldown}s before trying again.`)
      return
    }

    if (isStarting) return

    setIsStarting(true)
    setToast('')

    try {
      await startServer()
      setCooldown(START_COOLDOWN_SECONDS)
      setToast('Start requested! — it usually takes a minute or two.')
      await checkServerStatus()
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Could not reach the server manager.')
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <>
      {/* ── How to Connect ── */}
      <div className="info-card section-page-card mc-doc-card">
        <h3>How to Connect</h3>
        <p className="mc-card-body">Full connection instructions, server rules, and mods are in the guide below.</p>
        <div className="mc-doc-footer">
          <a
            href={MC_DOC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mc-doc-link"
          >
            Open Connection Guide
          </a>
        </div>
      </div>

      {/* ── Server Status + Control Dashboard ── */}
      <div className="info-card section-page-card mc-server-card">
        <div className="mc-srvstatus-header">
          <h3>Server Status</h3>
          <button
            className="mc-refresh-btn"
            onClick={checkServerStatus}
            disabled={srvChecking}
            title="Refresh status"
          >
            {srvChecking ? '…' : <><RotateCcw size={13} aria-hidden="true" /> Refresh</>}
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

        {srvLastChecked ? (
          <p className="mc-card-body mc-srv-address">
            <span className="mc-srv-checked">Checked {srvLastChecked.toLocaleTimeString()}</span>
          </p>
        ) : null}

        <hr className="mc-divider" />

        <p className="mc-card-body">
          {srvStatus?.online
            ? 'The server is online — join now!'
            : 'Start, stop, and monitor the server from the control dashboard.'}
        </p>

        <div className="mc-doc-footer mc-start-row">
          {srvStatus && !srvStatus.online ? (
            <button
              type="button"
              className="mc-doc-link"
              onClick={handleStart}
              disabled={isStarting}
              aria-describedby={toast ? 'mc-start-toast' : undefined}
            >
              {isStarting
                ? 'Starting…'
                : cooldown > 0
                  ? `Start Server (${cooldown}s)`
                  : 'Start Server'}
            </button>
          ) : null}

          <a href="/minecraft.html" className="mc-doc-link mc-doc-link--quiet">
            Open Control Dashboard
          </a>
        </div>

        {toast ? (
          <p id="mc-start-toast" className="mc-toast" role="status" aria-live="polite">
            {toast}
          </p>
        ) : null}
      </div>
    </>
  )
}

export default App
