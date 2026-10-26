import React, {
  type CSSProperties,
  type FormEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  Activity,
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  House,
  List,
  Plus,
  NotebookPen,
  Newspaper,
  Pencil,
  RotateCcw,
  Trash2,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { GoogleLogin, useGoogleOneTapLogin, type CredentialResponse } from '@react-oauth/google'
import {
  clearStoredToken,
  exchangeForSession,
  getTokenEmail as getGoogleTokenEmail,
  needsSession,
  readStoredToken,
  writeStoredToken,
} from './data/auth/session'
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  useOutletContext,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { useRouteMeta } from './routeMeta'
import { RouteErrorBoundary } from './RouteErrorBoundary'
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
import { MonthTileHeatmap, type HeatmapDay } from './components/MonthTileHeatmap'
import { GitHubActivity } from './components/GitHubActivity'
import { profile } from './siteContent/profile'
import { TrainingPrs } from './admin/garmin/TrainingPrs'
import {
  TRAINING_VIEWS,
  VIEW_CHART,
  VIEW_COLUMNS,
  activitiesFor,
  viewSummary,
  type TrainingView,
} from './admin/training/activities'
import { PageFrame, SummaryText } from './components/PageFrame'
import { TasksPage } from './tasks/TasksPage'
import { applySavedOrder, arrayMove, saveOrder } from './tasks/taskOrder'
import { useWeather, type WeatherHook } from './weather/useWeather'
import { AdminPage } from './admin/AdminPage'
import { CalendarWeekCard } from './admin/CalendarWeekCard'
import { GmailSummaryCard } from './admin/GmailSummaryCard'
import { JournalDashboard } from './admin/JournalDashboard'
import { AceLauncher } from './admin/ace/AceLauncher'
import { NewsDashboard } from './admin/news/NewsDashboard'
import { CiaraDashboard } from './admin/ciara/CiaraDashboard'
import { WorkoutText } from './training/WorkoutText'
import { TrainingOfDayCard } from './training/TrainingOfDayCard'
import {
  describeGarminActivity,
  byGarminStartOrder,
  isRestDayWorkout,
  parseTrainingDate,
  toDateOnlyKey,
} from './training/workoutsOfDay'
import { assignPlanDates, parseWorkoutTable } from './training/workoutPlan'
import { dueDateKey, dueSortValue, formatDayLabel, isOverdue, todayKey, tomorrowKey } from './data/todoist/dates'
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
  createEvent,
  deleteEvent,
  getEvents,
  getGarminHealth,
  getTrainingRecords,
  updateEvent,
  upsertTrainingRecord,
} from './data/sheets/repositories'
import type {
  EventRecord,
  GarminHealthRecord,
  TrainingRecord,
} from './data/sheets/types'
import { warmupAppsScript } from './data/sheets/client'
import {
  closeTask,
  createTaskDetailed,
  deleteTask,
  getActiveTasks,
  getTasksOfTheDay,
  rescheduleTask,
  updateTaskDetails,
} from './data/todoist/repositories'
import type { TodoistTask } from './data/todoist/types'
import { getServerStatus, startServer } from './minecraft/api'

type ThemeMode = 'light' | 'dark'
type UserProfile = 'guest' | 'admin'
const TODOIST_EDITOR_EMAIL = 'pasionabe@gmail.com'
const ADMIN_GOOGLE_EMAILS = ['pasionabe@gmail.com', 'pixielee1000@gmail.com']

const googleClientConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim())

function isTodoistConfigured() {
  return Boolean(import.meta.env.VITE_TODOIST_API_TOKEN?.trim())
}

function getInitialProfile(): UserProfile {
  if (typeof window === 'undefined') {
    return 'guest'
  }

  const storedProfile = window.localStorage.getItem('demo-profile')
  return storedProfile === 'admin' ? 'admin' : 'guest'
}

function shouldUseAdminProfile(googleEmail: string) {
  return ADMIN_GOOGLE_EMAILS.includes(googleEmail)
}


function App() {
  const [profile, setProfile] = useState<UserProfile>(() => getInitialProfile())
  // Admin-only: preview the site exactly as guests see it. Persisted so a
  // reload keeps the chosen lens; cleared on sign-out.
  const [viewAsGuest, setViewAsGuest] = useState(
    () => typeof window !== 'undefined' && window.localStorage.getItem('view-as-guest') === 'true',
  )

  useEffect(() => {
    window.localStorage.setItem('view-as-guest', viewAsGuest ? 'true' : 'false')
  }, [viewAsGuest])
  // Holds whichever bearer proves who you are: a Google ID token for the moment
  // between signing in and the exchange below, then one of our own 30-day
  // sessions. Both carry `email` and `exp`, so everything reading this cannot
  // tell them apart and does not need to.
  const [googleIdToken, setGoogleIdToken] = useState(() => readStoredToken())
  const previousGoogleTokenRef = useRef<string | null>(null)
  const googleEmail = getGoogleTokenEmail(googleIdToken)
  const trueAdmin = profile === 'admin' && shouldUseAdminProfile(googleEmail)
  const isAdmin = trueAdmin && !viewAsGuest

  useEffect(() => {
    warmupAppsScript()
  }, [])

  useEffect(() => {
    window.localStorage.setItem('demo-profile', profile)
  }, [profile])

  useEffect(() => {
    if (!googleIdToken) {
      clearStoredToken()
      return
    }

    writeStoredToken(googleIdToken)
  }, [googleIdToken])

  // Upgrade a just-signed-in Google token to a session, and slide an existing
  // session forward in its last week. Failure is deliberately silent: a flaky
  // network leaves the current token in place rather than signing you out,
  // which is the whole problem this exists to fix.
  useEffect(() => {
    if (!needsSession(googleIdToken)) {
      return
    }

    let cancelled = false
    void exchangeForSession(googleIdToken).then((session) => {
      if (!cancelled && session) {
        setGoogleIdToken(session)
      }
    })

    return () => {
      cancelled = true
    }
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
      setViewAsGuest(false)
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
              isTrueAdmin={trueAdmin}
              viewAsGuest={viewAsGuest}
              onToggleGuestView={() => setViewAsGuest((value) => !value)}
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
              path="health"
              element={<AdminHealthPage profile={profile} googleIdToken={googleIdToken} />}
            />
            <Route path="training" element={<Navigate replace to="/admin/health" />} />
            <Route path="news" element={<NewsDashboard idToken={googleIdToken} />} />
            <Route path="ciara" element={<CiaraDashboard idToken={googleIdToken} />} />
          </Route>

          <Route
            path="tasks"
            element={
              isAdmin ? (
                <TasksPage
                  canEdit={getGoogleTokenEmail(googleIdToken) === TODOIST_EDITOR_EMAIL}
                  configured={isTodoistConfigured()}
                  idToken={googleIdToken}
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

          {/* Sections that moved or were retired. Finance, Work and System are
              gone entirely; their old URLs fall through to the catch-all. */}
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
 * What the admin sees at `/` instead of the public sections: the month's
 * calendar, today's tasks and weather, and the inbox. Ace is not a card here
 * any more — it floats over every admin page (see AceLauncher).
 */
function AdminHomePage({ profile, googleIdToken }: { profile: UserProfile; googleIdToken: string }) {
  const weather = useOutletContext<WeatherHook>()
  return (
    /*
     * The admin home renders its own shell rather than going through AdminPage,
     * so it has to set --page-accent itself — without it, accented controls
     * fall back to the global purple instead of the Home dashboard's blue.
     */
    <div
      className="admin-page admin-home"
      style={{ '--page-accent': adminDashboardsById.home.accent } as CSSProperties}
    >
      <CalendarWeekCard title="Calendar and Weather" idToken={googleIdToken} weather={weather} />

      {/* Reuses the public home-top-row layout: equal columns and a fixed height
          on desktop, so switching tabs inside the tasks card cannot resize the row. */}
      <div className="home-top-row">
        <TodoistTasksCard title="Tasks of the Day" profile={profile} googleIdToken={googleIdToken} />
        <TrainingOfDayCard title="Training of the Day" />
      </div>

      <GmailSummaryCard title="Inbox" idToken={googleIdToken} />

    </div>
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
      <TrainingDataCard title="Training" />
      <TrainingLogCard title="Training Log" />
    </AdminPage>
  )
}

/** Minimal line icons for the admin top bar, keyed off AdminDashboardMeta.icon. */
const ADMIN_NAV_ICONS: Record<AdminIconId, LucideIcon> = {
  home: House,
  personal: NotebookPen,
  health: Activity,
  news: Newspaper,
  ciara: UserRound,
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
  // One weather fetch for the whole admin area: the top bar, the weather card, and the month view.
  const weather = useWeather(isAdmin)
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
    <div
      className={`app-shell ${isAdmin ? 'app-shell-admin' : ''}`}
      style={{ '--nav-accent': adminDashboards.find((dashboard) => dashboard.path === location.pathname)?.accent ?? '#9333ea' } as CSSProperties}
    >
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
          {isAdmin && weather.data ? (
            <span className="topbar-temperature" title="Current temperature">
              {Math.round(weather.data.current.temperature)}°
            </span>
          ) : null}
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
        {/* Keyed by path: a crash on one page is contained to that page, and
            navigating anywhere else remounts a clean boundary automatically —
            no more needing a hard refresh to recover. */}
        <RouteErrorBoundary key={location.pathname}>
          <Outlet context={weather} />
        </RouteErrorBoundary>
      </main>

      {/* Lives in the layout rather than a page, so a conversation survives
          moving between dashboards. */}
      {isAdmin ? <AceLauncher idToken={googleIdToken} todoistConfigured={isTodoistConfigured()} /> : null}
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
  gridClassName = '',
  children,
}: {
  id: SectionId
  isOpen: boolean
  onToggle: () => void
  downloadPdfHref?: string
  downloadWordHref?: string
  /** Extra class on the card grid, for a section that lays its cards out differently. */
  gridClassName?: string
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
          <span className="home-section-titles">
            <span className="eyebrow">{section.eyebrow}</span>
            <span id={headingId} className="home-section-title">{section.title}</span>
          </span>
          <ChevronDown className="home-section-chevron" size={18} strokeWidth={1.8} aria-hidden="true" />
        </button>
        <span className="home-section-index" aria-hidden="true">
          {String(ALL_SECTION_IDS.indexOf(id) + 1).padStart(2, '0')}
        </span>

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
        <div className={`page-grid ${gridClassName}`.trim()}>{children}</div>
      </div>
    </section>
  )
}

const ALL_SECTION_IDS: SectionId[] = ['experiences', 'training', 'personal-sites', 'gaming']

/** The public home page: collapsible sections. Admins get AdminHomePage. */
function HomePage() {
  const location = useLocation()
  /*
   * Experiences opens by default — it is the resume, and the reason most
   * visitors are here. The others stay collapsed so the page stays scannable.
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
        gridClassName="experiences-grid"
      >
        <ExperiencesOverview
          skillsBody={
            sectionPages.experiences.cards.find((card) => card.title === 'Technical Skills')?.body ?? ''
          }
        />
      </HomeSection>

      {/* Right under the résumé. Read-only here: the plan is pasted on /weekly-reset,
          and the log and countdown are edited from the Health dashboard. */}
      <HomeSection
        id="training"
        isOpen={openSections.includes('training')}
        onToggle={() => toggleSection('training')}
      >
        <WorkoutOfTheDayCard title="Workout of the Day" />
        <TrainingLogCard title="Training Log" showToday={false} />
        <NextEventCountdownCard title="Next Event Countdown" canWrite={false} idToken="" />
      </HomeSection>

      <HomeSection
        id="personal-sites"
        isOpen={openSections.includes('personal-sites')}
        onToggle={() => toggleSection('personal-sites')}
        gridClassName="projects-grid"
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

type PriorityLevel = 1 | 2 | 3 | 4
type PriorityFilter = 'all' | PriorityLevel

function parsePriorityLevel(value: string): PriorityLevel {
  return Number(value) as PriorityLevel
}

function parsePriorityFilter(value: string): PriorityFilter {
  return value === 'all' ? 'all' : parsePriorityLevel(value)
}


// The same saved-order keys the Tasks page uses, so the card and the page always agree.
const OVERDUE_ORDER = 'overdue'
const TODAY_ORDER = 'today'
const TOMORROW_ORDER = 'tomorrow'


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
  const [rows, setRows] = useState<TodoistTask[]>([])
  // Tomorrow's tasks load on first selection, so the card's first read stays today-only.
  const [day, setDay] = useState<'today' | 'tomorrow'>('today')
  const [tomorrowRows, setTomorrowRows] = useState<TodoistTask[]>([])
  const [isLoadingTomorrow, setIsLoadingTomorrow] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [newPriority, setNewPriority] = useState<PriorityLevel>(4)
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')
  const addInputRef = useRef<HTMLInputElement>(null)
  const [newContent, setNewContent] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isWriting, setIsWriting] = useState(false)
  const [writeError, setWriteError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState({ content: '', description: '', priority: 4 as PriorityLevel, dueDate: '' })

  const summaryOverdueCount = useMemo(() => rows.filter((row) => isOverdue(row)).length, [rows])
  const summaryTodayCount = rows.length - summaryOverdueCount
  const [, setOrderVersion] = useState(0)
  // Drag to reorder is for a mouse or trackpad; touch screens keep the arrows.
  const canDragRows = useMediaQuery('(hover: hover) and (pointer: fine)')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  // Overdue rows come first, then the day's own, each in the Tasks page's order.
  const byDue = (list: TodoistTask[]) => [...new Map(list.map((task) => [task.id, task])).values()].sort((a, b) => dueSortValue(a) - dueSortValue(b))
  const orderedRows =
    day === 'today'
      ? [
          ...applySavedOrder(byDue(rows.filter((row) => isOverdue(row))), OVERDUE_ORDER),
          ...applySavedOrder(byDue(rows.filter((row) => !isOverdue(row))), TODAY_ORDER),
        ]
      : applySavedOrder(byDue(tomorrowRows), TOMORROW_ORDER)
  const shownRows =
    priorityFilter === 'all' ? orderedRows : orderedRows.filter((row) => normalizePriority(row.priority) === priorityFilter)

  async function loadTomorrow() {
    setIsLoadingTomorrow(true)
    try {
      const all = await getActiveTasks()
      setTomorrowRows(all.filter((task) => dueDateKey(task) === tomorrowKey()))
      setWriteError('')
    } catch (error) {
      setTomorrowRows([])
      setWriteError(error instanceof Error ? error.message : 'Unable to load tomorrow’s tasks')
    } finally {
      setIsLoadingTomorrow(false)
    }
  }

  function selectDay(next: 'today' | 'tomorrow') {
    setDay(next)
    if (next === 'tomorrow' && todoistConfigured) {
      void loadTomorrow()
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
    if (!todoistConfigured) {
      setRows([])
      setIsLoading(false)
      return
    }

    void loadTasks()
  }, [])

  /** New tasks land on the day being viewed: today's list makes a task due today, tomorrow's one due tomorrow. */
  async function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = newContent.trim()
    if (!content || isWriting || !todoistConfigured || !canEditTodoist) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await createTaskDetailed({
        content,
        dueDate: day === 'tomorrow' ? tomorrowKey() : todayKey(),
        priority: newPriority,
      })
      // Stay open for the next task: clear the name, keep the day and priority, and refocus.
      setNewContent('')
      addInputRef.current?.focus()
      await (day === 'tomorrow' ? loadTomorrow() : loadTasks())
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to add task')
    } finally {
      setIsWriting(false)
    }
  }

  /** Saves a new row order under the Tasks page's keys, overdue rows apart from the day's own. */
  function persistOrder(ids: string[]) {
    if (day === 'tomorrow') {
      saveOrder(TOMORROW_ORDER, ids)
    } else {
      const overdueIds = new Set(rows.filter((row) => isOverdue(row)).map((row) => row.id))
      saveOrder(OVERDUE_ORDER, ids.filter((id) => overdueIds.has(id)))
      saveOrder(TODAY_ORDER, ids.filter((id) => !overdueIds.has(id)))
    }
    setOrderVersion((version) => version + 1)
  }

  /** Swaps a row with its neighbour in the day's saved order. */
  function moveRow(taskId: string, delta: -1 | 1) {
    const from = shownRows.findIndex((row) => row.id === taskId)
    const neighbour = shownRows[from + delta]
    if (from < 0 || !neighbour) return
    // Swap within the whole day's order, so a filtered view moves past the hidden rows correctly.
    const ids = orderedRows.map((row) => row.id)
    const a = ids.indexOf(taskId)
    const b = ids.indexOf(neighbour.id)
    ;[ids[a], ids[b]] = [ids[b], ids[a]]
    persistOrder(ids)
  }

  /** Moves every missed (overdue) task to today; repeating ones resend their repeat so it isn't ended. */
  async function handleRescheduleMissed() {
    const missed = rows.filter((row) => isOverdue(row))
    if (missed.length === 0 || isWriting || !todoistConfigured || !canEditTodoist) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      const today = todayKey()
      await Promise.all(
        missed.map((task) =>
          task.due?.is_recurring ? rescheduleTask(task.id, today, task.due.string) : rescheduleTask(task.id, today),
        ),
      )
      await loadTasks()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to reschedule tasks')
    } finally {
      setIsWriting(false)
    }
  }

  /** Drops the dragged row where the target row sits, in the day's saved order. */
  function dropRow(targetId: string) {
    const draggedId = dragId
    setDragId(null)
    setDragOverId(null)
    if (!draggedId || draggedId === targetId) return
    const ids = orderedRows.map((row) => row.id)
    const from = ids.indexOf(draggedId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    persistOrder(arrayMove(ids, from, to))
  }

  async function handleDeleteTask(task: TodoistTask) {
    if (isWriting || !todoistConfigured || !canEditTodoist) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await deleteTask(task.id)
      await (day === 'tomorrow' ? loadTomorrow() : loadTasks())
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to delete task')
    } finally {
      setIsWriting(false)
    }
  }

  /** Opens a task's editor, or closes it when it is already open. */
  function toggleEdit(task: TodoistTask) {
    if (editingId === task.id) {
      setEditingId(null)
      return
    }
    setDraft({
      content: task.content,
      description: task.description ?? '',
      priority: normalizePriority(task.priority) as PriorityLevel,
      dueDate: dueDateKey(task),
    })
    setEditingId(task.id)
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>, task: TodoistTask) {
    event.preventDefault()
    const content = draft.content.trim()
    if (!content || isWriting || !todoistConfigured || !canEditTodoist) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await updateTaskDetails(task.id, { content, description: draft.description.trim(), priority: draft.priority })
      // Only today or later; a repeating task resends its repeat so the date move doesn't end it.
      if (draft.dueDate && draft.dueDate >= todayKey() && draft.dueDate !== dueDateKey(task)) {
        await (task.due?.is_recurring
          ? rescheduleTask(task.id, draft.dueDate, task.due.string)
          : rescheduleTask(task.id, draft.dueDate))
      }
      setEditingId(null)
      await (day === 'tomorrow' ? loadTomorrow() : loadTasks())
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to save task')
    } finally {
      setIsWriting(false)
    }
  }

  /** Pushes a task to tomorrow in one tap; a repeating task resends its repeat so it isn't ended. */
  async function handleMoveToTomorrow(task: TodoistTask) {
    if (isWriting || !todoistConfigured || !canEditTodoist) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await (task.due?.is_recurring
        ? rescheduleTask(task.id, tomorrowKey(), task.due.string)
        : rescheduleTask(task.id, tomorrowKey()))
      setEditingId(null)
      await (day === 'tomorrow' ? loadTomorrow() : loadTasks())
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to move task to tomorrow')
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
      await (day === 'tomorrow' ? loadTomorrow() : loadTasks())
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to mark task complete')
    } finally {
      setIsWriting(false)
    }
  }

  return (
    <article className={`info-card home-todoist-card sheets-card${isCollapsed ? ' is-collapsed' : ''}`}>
      <div className="section-card-header">
        <div className="section-card-title-row">
          {/* Icon-only, so the name lives in aria-label and the hover tooltip. */}
          <Link to="/tasks" className="admin-quick-link" aria-label="Full task manager" title="Full task manager">
            <List size={15} strokeWidth={1.8} aria-hidden="true" />
          </Link>
          <select
            className="task-input todoist-priority-select"
            value={priorityFilter}
            aria-label="Filter by priority"
            title="Filter by priority"
            onChange={(event) => setPriorityFilter(parsePriorityFilter(event.target.value))}
          >
            <option value="all">All</option>
            <option value="1">P1</option>
            <option value="2">P2</option>
            <option value="3">P3</option>
            <option value="4">P4</option>
          </select>
          <h3>{title}</h3>
        </div>
        <div className="section-card-actions">
          {todoistConfigured && canEditTodoist ? (
            <button
              type="button"
              className="section-collapse-btn"
              aria-label="Reschedule missed tasks to today"
              title="Reschedule missed tasks to today"
              disabled={isWriting || summaryOverdueCount === 0}
              onClick={() => void handleRescheduleMissed()}
            >
              <RotateCcw size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : null}
          {todoistConfigured && canEditTodoist ? (
            <button
              type="button"
              className="section-collapse-btn"
              aria-expanded={isAdding}
              aria-label={`Add task to ${day === 'tomorrow' ? 'tomorrow' : 'today'}`}
              title={`Add task to ${day === 'tomorrow' ? 'tomorrow' : 'today'}`}
              onClick={() => setIsAdding((value) => !value)}
            >
              <Plus size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            className="section-collapse-btn home-todoist-collapse-btn"
            aria-expanded={!isCollapsed}
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="home-todoist-collapsible">
          <div className="experience-toggle todoist-day-toggle" role="tablist" aria-label="Tasks by day">
            {(['today', 'tomorrow'] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={day === id}
                className={`experience-toggle-btn ${day === id ? 'active' : ''}`}
                onClick={() => selectDay(id)}
              >
                {id === 'today' ? 'Today' : 'Tomorrow'}
              </button>
            ))}
          </div>

          <p className="sheets-meta">
            {day === 'today' ? 'Scope: Today + overdue tasks from Todoist.' : 'Scope: Tasks due tomorrow.'}
          </p>

          {!todoistConfigured ? (
            <p className="sheets-error">Set VITE_TODOIST_API_TOKEN in your .env file, then restart the app.</p>
          ) : null}

          {todoistConfigured && isLoading ? <p className="sheets-meta">Loading Todoist tasks...</p> : null}

          {!canEditTodoist ? (
            <p className="sheets-meta">
              Edit access restricted to admin.
            </p>
          ) : null}

          {todoistConfigured && day === 'tomorrow' && isLoadingTomorrow ? (
            <p className="sheets-meta">Loading tomorrow’s tasks...</p>
          ) : null}

          {todoistConfigured && (day === 'today' ? !isLoading : !isLoadingTomorrow) ? (
            <div className="todoist-summary">
              <p className="sheets-meta">
                {day === 'today' ? (
                  <>
                    {summaryOverdueCount > 0 ? (
                      <span className="todoist-summary-alert">{summaryOverdueCount} overdue</span>
                    ) : null}
                    {summaryOverdueCount > 0 ? ' · ' : ''}
                    {summaryTodayCount} due today
                  </>
                ) : (
                  <>{tomorrowRows.length} due tomorrow</>
                )}
              </p>

              {shownRows.length > 0 ? (
                <ol className={`todoist-task-list ${day === 'today' ? 'is-numbered' : 'is-unnumbered'}`}>
                  {shownRows.map((row, index) => (
                    <li
                      key={`summary-${row.id}`}
                      className={`todoist-task-item${dragId === row.id ? ' is-dragging' : ''}${dragOverId === row.id && dragId !== row.id ? ' is-drop-target' : ''}`}
                      {...(canDragRows && canEditTodoist && editingId !== row.id
                        ? {
                            draggable: true,
                            onDragStart: (event: DragEvent<HTMLLIElement>) => {
                              event.dataTransfer.effectAllowed = 'move'
                              event.dataTransfer.setData('text/plain', row.id)
                              setDragId(row.id)
                            },
                            onDragOver: (event: DragEvent<HTMLLIElement>) => {
                              if (!dragId) return
                              event.preventDefault()
                              setDragOverId(row.id)
                            },
                            onDrop: (event: DragEvent<HTMLLIElement>) => {
                              event.preventDefault()
                              dropRow(row.id)
                            },
                            onDragEnd: () => {
                              setDragId(null)
                              setDragOverId(null)
                            },
                          }
                        : {})}
                    >
                    {day === 'today' ? (
                      <span className="todoist-task-number" aria-hidden="true">
                        {index + 1}
                      </span>
                    ) : null}
                    <div className="todoist-task-stack">
                    <div
                      className={`todoist-task-row${row.is_completed ? ' is-completed' : ''}${editingId === row.id ? ' is-editing' : ''}`}
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
                      <div
                        className="todoist-task-content"
                        {...(canEditTodoist
                          ? {
                              role: 'button',
                              tabIndex: 0,
                              'aria-expanded': editingId === row.id,
                              'aria-label': `Edit: ${row.content}`,
                              onClick: () => toggleEdit(row),
                              onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  toggleEdit(row)
                                }
                              },
                            }
                          : {})}
                      >
                        <p className={row.is_completed ? 'todoist-task-done' : ''}>{row.content}</p>
                      </div>
                      {isOverdue(row) ? (
                        <p className="todoist-summary-overdue">{formatDayLabel(dueDateKey(row))}</p>
                      ) : null}
                      {canEditTodoist ? (
                        <div className="todoist-row-actions">
                          <button
                            type="button"
                            className="todoist-row-btn"
                            aria-label={`Move ${row.content} up`}
                            title="Move up"
                            disabled={isWriting || index === 0}
                            onClick={() => moveRow(row.id, -1)}
                          >
                            <ChevronUp size={14} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="todoist-row-btn"
                            aria-label={`Move ${row.content} down`}
                            title="Move down"
                            disabled={isWriting || index === shownRows.length - 1}
                            onClick={() => moveRow(row.id, 1)}
                          >
                            <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="todoist-row-btn is-danger"
                            aria-label={`Delete ${row.content}`}
                            title="Delete task"
                            disabled={isWriting}
                            onClick={() => void handleDeleteTask(row)}
                          >
                            <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {canEditTodoist && editingId === row.id ? (
                      <form className="todoist-inline-edit" onSubmit={(event) => void handleSaveEdit(event, row)}>
                        <input
                          className="task-input"
                          value={draft.content}
                          autoFocus
                          aria-label="Task name"
                          onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') setEditingId(null)
                          }}
                        />
                        <textarea
                          className="task-input todoist-inline-edit-desc"
                          value={draft.description}
                          placeholder="Description"
                          aria-label="Task description"
                          onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                        />
                        <div className="todoist-inline-edit-row">
                          <select
                            className="task-input"
                            value={draft.priority}
                            aria-label="Task priority"
                            onChange={(event) =>
                              setDraft((current) => ({ ...current, priority: parsePriorityLevel(event.target.value) }))
                            }
                          >
                            <option value={1}>P1</option>
                            <option value={2}>P2</option>
                            <option value={3}>P3</option>
                            <option value={4}>P4</option>
                          </select>
                          <input
                            type="date"
                            className="task-input"
                            value={draft.dueDate}
                            aria-label="Due date"
                            onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))}
                          />
                          {row.due?.is_recurring ? <span className="sheets-meta">Repeat stays as is</span> : null}
                        </div>
                        <div className="todoist-inline-edit-actions">
                          <button type="submit" className="task-btn is-primary" disabled={isWriting || !draft.content.trim()}>
                            Save
                          </button>
                          <button type="button" className="task-btn" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                          {dueDateKey(row) !== tomorrowKey() ? (
                            <button
                              type="button"
                              className="task-btn"
                              disabled={isWriting}
                              onClick={() => void handleMoveToTomorrow(row)}
                            >
                              Move to tomorrow
                            </button>
                          ) : null}
                        </div>
                      </form>
                    ) : null}
                    </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="sheets-meta">
                  {priorityFilter !== 'all'
                    ? `No P${priorityFilter} tasks ${day === 'today' ? 'today' : 'tomorrow'}.`
                    : day === 'today'
                      ? 'No tasks due today or overdue.'
                      : 'Nothing due tomorrow.'}
                </p>
              )}

            </div>
          ) : null}

          {todoistConfigured && !isLoading && rows.length === 0 && !canEditTodoist && !writeError ? (
            <p className="sheets-meta">No tasks due today or overdue.</p>
          ) : null}

          {isAdding && todoistConfigured && canEditTodoist ? (
            <form className="task-add-form todoist-add-form" onSubmit={(event) => void handleAddTask(event)}>
              <input
                ref={addInputRef}
                className="task-input"
                value={newContent}
                autoFocus
                placeholder="Task name"
                aria-label="New task name"
                onChange={(event) => setNewContent(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setIsAdding(false)
                }}
              />
              <div className="task-edit-row is-inline">
                <span className="sheets-meta">Due {day === 'tomorrow' ? 'tomorrow' : 'today'}</span>
                <select
                  className="task-input"
                  value={newPriority}
                  aria-label="New task priority"
                  onChange={(event) => setNewPriority(parsePriorityLevel(event.target.value))}
                >
                  <option value={1}>P1</option>
                  <option value={2}>P2</option>
                  <option value={3}>P3</option>
                  <option value={4}>P4</option>
                </select>
              </div>
              <div className="task-edit-actions">
                <button type="submit" className="task-btn is-primary" disabled={isWriting || !newContent.trim()}>
                  Add task
                </button>
                <button type="button" className="task-btn" onClick={() => setIsAdding(false)}>
                  Cancel
                </button>
              </div>
            </form>
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
          <p className="project-tagline">{entry.tagline}</p>
        </div>
        {/* The card's action sits in its first row; the status rides the top border. */}
        <a href={entry.url} target="_blank" rel="noreferrer" className="project-visit">
          <ExternalLink size={15} strokeWidth={1.8} aria-hidden="true" />
          <span>Try it</span>
        </a>
        <span className="admin-pill project-status">{STATUS_LABELS[entry.status]}</span>
      </div>

      <p className="project-description">{entry.description}</p>

      <div className="project-stack">
        {entry.stack.map((tool) => (
          <span key={tool} className="project-chip">
            {tool}
          </span>
        ))}
      </div>
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
          aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
          onClick={() => setIsCollapsed((value) => !value)}
        >
          <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      {!isCollapsed ? children : null}
    </article>
  )
}

function TechnicalSkillsList({ body }: { body: string }) {
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return (
    <ul className="technical-skills-list">
      {lines.map((line) => {
        const cleanedLine = line.replace(/^•\s*/, '')
        const isDetail = cleanedLine.startsWith('-')

        return (
          <li key={line} className={isDetail ? 'technical-skill-detail' : 'technical-skill-heading'}>
            {/* Detail lines in the content start with a doubled "-   -" marker. */}
            {isDetail ? cleanedLine.replace(/^(-\s*)+/, '') : cleanedLine}
          </li>
        )
      })}
    </ul>
  )
}

/** Tracks a CSS media query, for components that swap layouts rather than just restyle. */
function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    [query],
  )

  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

type ExperienceTab = 'work' | 'education' | 'skills'

const EXPERIENCE_TABS: { id: ExperienceTab; label: string; title: string }[] = [
  { id: 'work', label: 'Experience', title: 'Professional Experience' },
  { id: 'education', label: 'Education', title: 'Education' },
  { id: 'skills', label: 'Skills', title: 'Technical Skills' },
]

/**
 * Work, education and skills. On desktop they sit side by side, all open; on
 * narrower screens they share one card as tabs, so opening the section lands on
 * content rather than on three more collapsed cards. Every panel stays in the
 * DOM either way, because this is the only indexed page on the site.
 */
function ExperiencesOverview({ skillsBody }: { skillsBody: string }) {
  const isWide = useMediaQuery('(min-width: 900px)')
  const [activeTab, setActiveTab] = useState<ExperienceTab>('work')

  const panes: Record<ExperienceTab, ReactNode> = {
    work: <ProfessionalExperienceList />,
    education: <EducationList />,
    skills: <TechnicalSkillsList body={skillsBody} />,
  }

  if (isWide) {
    return (
      <>
        {EXPERIENCE_TABS.map((tab) => (
          <article
            key={tab.id}
            className={`info-card section-page-card experience-card experience-pane-${tab.id}`}
          >
            <h3>{tab.title}</h3>
            {panes[tab.id]}
          </article>
        ))}
      </>
    )
  }

  return (
    <article className="info-card section-page-card experience-tabs-card">
      <div className="experience-tabs" role="tablist" aria-label="Experiences">
        {EXPERIENCE_TABS.map((tab) => (
          <button
            key={tab.id}
            id={`experience-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab}
            aria-controls={`experience-panel-${tab.id}`}
            className="experience-tab"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {EXPERIENCE_TABS.map((tab) => (
        <section
          key={tab.id}
          id={`experience-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`experience-tab-${tab.id}`}
          className="experience-panel"
          hidden={tab.id !== activeTab}
        >
          {/* The tab already names the panel on screen; the heading keeps the outline. */}
          <h3 className="sr-only">{tab.title}</h3>
          {panes[tab.id]}
        </section>
      ))}
    </article>
  )
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

  return [...byDay.entries()].map(([date, dayRows]) => {
    const [first, second] = [...dayRows].sort(byGarminStartOrder)
    return {
      training_id: date,
      date,
      morning_workout: first ? describeGarminActivity(first) : '',
      evening_workout: second ? describeGarminActivity(second) : '',
      completed_morning: dayRows.length >= 1,
      completed_evening: dayRows.length >= 2,
    }
  })
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
  showToday = true,
}: {
  title: string
  /**
   * The panel of today's Garmin activities under the tiles. Off on the guest
   * home page, where the planned Workout of the Day card sits above the log.
   */
  showToday?: boolean
}) {
  const currentDate = new Date()
  const currentYear = String(currentDate.getFullYear())

  const [rows, setRows] = useState<TrainingRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState(currentYear)
  // The heatmap of days trained, or the personal records board.
  const [view, setView] = useState<'tiles' | 'prs'>('tiles')

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

  const recordsByDay = useMemo(() => {
    const byDate = new Map<string, TrainingRecord>()
    for (const row of filteredRows) {
      const key = toDateOnlyKey(row.date)
      if (key) {
        byDate.set(key, row)
      }
    }
    return byDate
  }, [filteredRows])

  /*
   * One tile per day, whether or not anything was recorded. Garmin only
   * returns rows for days with an activity, so a day without one is an empty
   * tile keyed by its date rather than a gap in the calendar.
   */
  const trainingDayInfo = useCallback(
    (key: string): HeatmapDay => {
      const row = recordsByDay.get(key)
      const activities = row ? [row.morning_workout, row.evening_workout].filter(Boolean) : []
      return {
        level: row ? getTrainingTileLevel(row) : 0,
        label: activities.length
          ? `${formatSheetDate(key)} — ${activities.join(', ')}`
          : `${formatSheetDate(key)} — no activity`,
        data: { 'data-training-id': row?.training_id ?? key },
      }
    },
    [recordsByDay],
  )

  const todayDate = new Date()
  const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`
  const todaysRecord = useMemo(
    () => rows.find((row) => toDateOnlyKey(row.date) === todayKey),
    [rows, todayKey],
  )

  return (
    <CollapsibleSectionCard title={title} className="training-log-card">
      <div className="experience-toggle training-log-view" role="group" aria-label="Training log view">
        {(['tiles', 'prs'] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={view === option}
            className={`experience-toggle-btn ${view === option ? 'active' : ''}`}
            onClick={() => setView(option)}
          >
            {option === 'tiles' ? 'Tiles' : 'PRs'}
          </button>
        ))}
      </div>

      {view === 'prs' ? (
        <TrainingPrs />
      ) : isLoading ? (
        <p className="sheets-meta">Loading training log...</p>
      ) : (
        <>
          <div className="training-log-main">
            <MonthTileHeatmap
              year={Number(yearFilter)}
              years={selectableYears}
              onYearChange={(year) => setYearFilter(String(year))}
              dayInfo={trainingDayInfo}
              label="Training activity tiles by month"
              tileNoun="training activity"
            />
            <p className="sheets-meta">Light: one workout completed or rest day. Dark: both workouts completed.</p>
          </div>

          {showToday ? (
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
                        <td><WorkoutText value={todaysRecord.morning_workout} empty="Morning —" /></td>
                        <td className="study-complete-cell">
                          <span>{todaysRecord.completed_morning ? <><Check size={12} aria-hidden="true" /> Yes</> : 'No'}</span>
                        </td>
                      </tr>
                      <tr>
                        <td><WorkoutText value={todaysRecord.evening_workout} empty="Evening —" /></td>
                        <td className="study-complete-cell">
                          <span>{todaysRecord.completed_evening ? <><Check size={12} aria-hidden="true" /> Yes</> : 'No'}</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="sheets-meta">No workout scheduled for today.</p>
              )}

            </div>
          ) : null}
        </>
      )}
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

type EventDraft = { eventName: string; eventDate: string }

const EMPTY_EVENT_DRAFT: EventDraft = { eventName: '', eventDate: '' }

function eventTime(row: EventRecord) {
  const time = new Date(row.event_date).getTime()
  return Number.isNaN(time) ? null : time
}

function formatEventDate(row: EventRecord) {
  const time = eventTime(row)
  return time === null
    ? 'No date'
    : new Date(time).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
}

/**
 * Counts down to the soonest event still ahead. There is no "active" event to
 * pick any more: once one passes, the countdown moves on to the next by itself.
 * Events are a title and a date, kept in D1.
 */
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
  const [draft, setDraft] = useState<EventDraft>(EMPTY_EVENT_DRAFT)
  const [nowMs, setNowMs] = useState(Date.now())

  async function loadEvents() {
    try {
      setRows(await getEvents())
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

  // Soonest first; undated events last, so they are still listed for fixing.
  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => (eventTime(a) ?? Infinity) - (eventTime(b) ?? Infinity)),
    [rows],
  )
  const nextEvent = sortedRows.find((row) => (eventTime(row) ?? 0) > nowMs)
  const parts = getCountdownParts(nextEvent?.event_date ?? '', nowMs)

  function resetEventForm() {
    setEditingEventId('')
    setDraft(EMPTY_EVENT_DRAFT)
  }

  function startEditingEvent(row: EventRecord) {
    setEditingEventId(row.event_id)
    setDraft({ eventName: row.event_name, eventDate: toLocalDateTimeInputFromValue(row.event_date) })
    setWriteError('')
  }

  async function handleDeleteEvent(eventId: string) {
    if (!canWrite || !idToken || isWriting) {
      return
    }

    setIsWriting(true)
    setWriteError('')
    try {
      await deleteEvent(idToken, eventId)
      if (editingEventId === eventId) resetEventForm()
      await loadEvents()
    } catch (error) {
      setWriteError(error instanceof Error ? error.message : 'Unable to delete event')
    } finally {
      setIsWriting(false)
    }
  }

  async function handleSubmitEvent() {
    if (!canWrite || !idToken || isWriting) {
      return
    }

    const eventName = draft.eventName.trim()
    const eventDate = draft.eventDate.trim()
    if (!eventName || !eventDate) {
      setWriteError('Event title and event date are required.')
      return
    }

    setIsWriting(true)
    setWriteError('')

    try {
      if (editingEventId) {
        await updateEvent(idToken, editingEventId, { eventName, eventDate })
      } else {
        await createEvent(idToken, { eventName, eventDate })
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
            aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${title}`}
            onClick={() => setIsCollapsed((value) => !value)}
          >
            <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <>
          {isLoading ? <p className="sheets-meta">Loading events...</p> : null}

          {!isLoading && nextEvent ? (
            <>
              <p className="countdown-title">{nextEvent.event_name}</p>
              <p className="countdown-target">{formatEventDate(nextEvent)}</p>

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
            </>
          ) : null}

          {!isLoading && !nextEvent ? (
            <p className="countdown-lock-note">
              {canWrite ? 'No upcoming event. Add one with a future date to start the countdown.' : 'No upcoming event.'}
            </p>
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
                    value={draft.eventName}
                    onChange={(event) => setDraft((current) => ({ ...current, eventName: event.target.value }))}
                    placeholder="Race day, meet, hike, etc."
                    disabled={!idToken || isWriting}
                  />
                </label>

                <label>
                  <span>Event date</span>
                  <input
                    type="datetime-local"
                    value={draft.eventDate}
                    onChange={(event) => setDraft((current) => ({ ...current, eventDate: event.target.value }))}
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

              {sortedRows.length > 0 ? (
                <ul className="countdown-event-list">
                  {sortedRows.map((row) => {
                    const isPast = (eventTime(row) ?? Infinity) <= nowMs
                    return (
                      <li key={row.event_id} className={`countdown-event-item${isPast ? ' is-past' : ''}`}>
                        <span className="countdown-event-name">
                          {row.event_name}
                          <small>
                            {formatEventDate(row)}
                            {isPast ? ' · past' : ''}
                          </small>
                        </span>
                        <div className="countdown-event-actions">
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() => startEditingEvent(row)}
                            disabled={!idToken || isWriting}
                            aria-label={`Edit ${row.event_name}`}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="secondary-action"
                            onClick={() => void handleDeleteEvent(row.event_id)}
                            disabled={!idToken || isWriting}
                            aria-label={`Delete ${row.event_name}`}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="sheets-meta">No events yet.</p>
              )}
            </div>
          ) : null}

          {writeError ? <p className="sheets-error">{writeError}</p> : null}
        </>
      ) : null}
    </article>
  )
}

function EducationList() {
  return (
    <>
      <ul className="experience-list">
        {educationEntries.map((entry) => (
          <EducationRow
            key={`${entry.degree}-${entry.institution}`}
            entry={entry}
          />
        ))}
      </ul>
      {/* What I keep learning after the degree, in the Training Log's calendar. */}
      <GitHubActivity username={profile.github} />
    </>
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

function ProfessionalExperienceList() {
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

  // A filter, not tabs: on narrow screens it already sits inside a tab panel.
  return (
    <>
      <div className="experience-toggle" role="group" aria-label="Professional experience filter">
        <button
          type="button"
          aria-pressed={viewMode === 'technical'}
          className={`experience-toggle-btn ${viewMode === 'technical' ? 'active' : ''}`}
          onClick={() => setViewMode('technical')}
        >
          Technical
        </button>
        <button
          type="button"
          aria-pressed={viewMode === 'all'}
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
    </>
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
  // Notes are stored as "- point" lines; a real list keeps wrapped lines indented.
  const points = (entry.note ?? '')
    .split('\n')
    .map((line) => line.trim().replace(/^-\s*/, ''))
    .filter(Boolean)

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
        {points.length ? (
          <ul className="experience-points">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  )
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

function daysAgoISO(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
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
          // Steps, not slopes: each activity holds a level until the next.
          stepped:              'middle',
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

type ChartScale = '1W' | '1M' | '1Y' | 'all'
const SCALE_DAYS: Record<ChartScale, number> = { '1W': 7, '1M': 30, '1Y': 365, 'all': 0 }
const SCALE_LABELS: Record<ChartScale, string> = { '1W': '1W', '1M': '1M', '1Y': '1Y', 'all': 'All' }

/**
 * Garmin activities by sport: every workout, or just the runs, swims or rides.
 * Each view has its own 30-day summary, chart measure and table columns
 * (src/admin/training/activities.ts).
 */
function TrainingDataCard({ title }: { title: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [view,       setView]       = useState<TrainingView>('workouts')
  const [page,       setPage]       = useState(0)
  const [chartScale, setChartScale] = useState<ChartScale>('1M')
  const [isMobile,   setIsMobile]   = useState(() => window.matchMedia('(max-width: 640px)').matches)

  const [rows,      setRows]      = useState<GarminHealthRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError,  setHasError]  = useState(false)

  // Track viewport width so chart and columns update on resize
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    let mounted = true
    getGarminHealth()
      .then((d) => { if (mounted) setRows(d) })
      .catch(() => { if (mounted) setHasError(true) })
      .finally(() => { if (mounted) setIsLoading(false) })
    return () => { mounted = false }
  }, [])

  const viewMeta   = TRAINING_VIEWS.find((entry) => entry.id === view) ?? TRAINING_VIEWS[0]
  const viewRows   = useMemo(() => activitiesFor(view, rows), [view, rows])
  const columns    = isMobile ? VIEW_COLUMNS[view].filter((column) => column.compact) : VIEW_COLUMNS[view]
  const sortedRows = useMemo(
    () => [...viewRows].sort((a, b) => parseToISO(b.date).localeCompare(parseToISO(a.date))),
    [viewRows],
  )
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / 10))
  const pageRows   = sortedRows.slice(page * 10, (page + 1) * 10)
  const lastSync   = rows.reduce((latest, row) => (parseToISO(row.date) > latest ? parseToISO(row.date) : latest), '')
  const summary    = useMemo(() => viewSummary(view, rows), [view, rows])
  const chart      = VIEW_CHART[view]

  const chartPoints = useMemo(() => {
    const cutoff = chartScale === 'all' ? '' : daysAgoISO(SCALE_DAYS[chartScale])
    return [...viewRows]
      .sort((a, b) => parseToISO(a.date).localeCompare(parseToISO(b.date)))
      .map(r => ({ date: parseToISO(r.date), value: chart.value(r) ?? NaN }))
      .filter(p => !isNaN(p.value) && p.value > 0 && (chartScale === 'all' || p.date >= cutoff))
  }, [viewRows, chart, chartScale])

  const canvasMinWidth = useMemo(() => {
    if (isMobile) return '100%'
    if (chartScale === '1W' || chartScale === '1M') return '100%'
    if (chartScale === '1Y') return '1000px'
    return `${Math.max(1200, chartPoints.length * 6)}px`
  }, [chartScale, chartPoints.length, isMobile])

  function selectView(next: TrainingView) {
    setView(next)
    setPage(0)
  }

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
          <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      {isCollapsed ? null : (
      <>

      {/* ── Sport tabs ── */}
      <div className="experience-toggle" role="tablist" aria-label="Training view">
        {TRAINING_VIEWS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={view === entry.id}
            className={`experience-toggle-btn ${view === entry.id ? 'active' : ''}`}
            onClick={() => selectView(entry.id)}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="sheets-meta">Loading training…</p>
      ) : hasError ? (
        <p className="sheets-meta">Could not load Garmin activities. Check that the garmin_health tab exists and the API key is configured.</p>
      ) : rows.length === 0 ? (
        <p className="sheets-meta">No Garmin activities yet. They arrive with the next Garmin sync.</p>
      ) : (
        <>
          {/* ── Last 30 days ── */}
          <div className="wellbeing-section">
            <div className="wellbeing-grid">
              {summary.tiles.map(tile => (
                <div key={tile.label} className="wellbeing-stat">
                  <span className="wellbeing-stat-value">{tile.value}</span>
                  <span className="wellbeing-stat-meta">
                    <span className="wellbeing-stat-label">{tile.label}</span>
                  </span>
                </div>
              ))}
            </div>
            {summary.note && <p className="wellbeing-insight">{summary.note}</p>}
          </div>

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
              <div className="health-chart-empty">No {viewMeta.noun} in this time range</div>
            ) : (
              <HealthLineChart
                points={chartPoints}
                color={chart.color}
                unit={chart.unit}
                minWidth={canvasMinWidth}
                scale={chartScale}
              />
            )}

            <p className="health-chart-label">{chart.label} · {chartPoints.length} {chartPoints.length === 1 ? 'entry' : 'entries'}</p>
          </div>

          <p className="sheets-meta">
            {viewRows.length} {viewMeta.noun} · last synced {lastSync}
          </p>

          {/* ── Activity table ── */}
          {viewRows.length > 0 ? (
            <div className="health-data-table-scroll">
              <table className="health-data-table">
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column.label}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => (
                    <tr key={row.activity_id || `${row.date}-${row.title}`}>
                      {columns.map((column) => (
                        <td key={column.label}>{column.value(row) || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

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
  /*
   * Today and the six days after it. A rolling window rather than a fixed
   * Saturday-to-Friday week, so a plan pasted mid-week (say Wed–Sun) lands on
   * the coming days instead of its weekend falling back into the last one.
   */
  const start = new Date()
  start.setHours(0, 0, 0, 0)

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
      summary="One place to set this week's workouts."
      accent="#f97316"
      backLink="/admin"
      backLabel="Back to dashboards"
      note=""
    >
      <WeeklyWorkoutResetCard title="Workouts for the Week" canWrite={canWrite} idToken={googleIdToken} />
    </PageFrame>
  )
}

/**
 * Today's planned workout, read-only, for the guest home page. Planned rather
 * than recorded: what actually happened shows in the Training Log below it.
 */
function WorkoutOfTheDayCard({ title }: { title: string }) {
  const [record, setRecord] = useState<TrainingRecord | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const today = new Date()
  const todayKey = toDateOnlyKey(today.toISOString())

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const rows = await getTrainingRecords()
        if (!cancelled) setRecord(rows.find((row) => toDateOnlyKey(row.date) === todayKey))
      } catch {
        if (!cancelled) setRecord(undefined)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [todayKey])

  const hasWorkout = Boolean(record?.morning_workout || record?.evening_workout)

  return (
    <CollapsibleSectionCard title={title} className="workout-of-day-card">
      <p className="sheets-meta">
        {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
      </p>

      {isLoading ? (
        <p className="sheets-meta">Loading today&apos;s workout…</p>
      ) : hasWorkout ? (
        <div className="study-today-shell">
          {/* Two columns, morning beside evening, labels over the workouts. */}
          <table className="study-today-table workout-of-day-table">
            <thead>
              <tr>
                <th scope="col">Morning</th>
                <th scope="col">Evening</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <WorkoutText value={record?.morning_workout} />
                </td>
                <td>
                  <WorkoutText value={record?.evening_workout} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="sheets-meta">No workout planned for today.</p>
      )}
    </CollapsibleSectionCard>
  )
}

type WeeklyWorkoutDraft = { morning: string; evening: string }

const PASTE_PLACEHOLDER = [
  '| Day | Morning | Evening |',
  '|---|---|---|',
  '| Wed | **Easy swim**<br>• 4×50m free | Legs |',
].join('\n')

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
  const [isPasting, setIsPasting] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteMessage, setPasteMessage] = useState('')

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
        next[key] = { morning: '', evening: '' }
      })
      return next
    })
    setPasteMessage('')
    setSaveMessage('')
  }

  /*
   * Fill the drafts from a pasted plan. Nothing is saved here: the
   * rows land in the editor for a look over, then Save workouts writes them.
   */
  function handleFillFromPaste() {
    const parsed = parseWorkoutTable(pasteText)
    if (parsed.error) {
      setPasteMessage(parsed.error)
      return
    }

    const shown = new Set(weekDates.map((date) => toDateOnlyKey(date.toISOString())))
    const label = (date: Date) =>
      date.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' })
    const updates: Record<string, WeeklyWorkoutDraft> = {}
    const filled: string[] = []
    const outside: string[] = []

    const datedPlan = assignPlanDates(parsed.days, weekDates[0])
      .sort((left, right) => left.date.getTime() - right.date.getTime())
    for (const day of datedPlan) {
      const key = toDateOnlyKey(day.date.toISOString())
      if (shown.has(key)) {
        updates[key] = { morning: day.morning, evening: day.evening }
        filled.push(label(day.date))
      } else {
        outside.push(label(day.date))
      }
    }

    setDrafts((current) => ({ ...current, ...updates }))

    const notes = [
      filled.length
        ? `Filled ${filled.length === 1 ? filled[0] : `${filled[0]} – ${filled[filled.length - 1]}`}. Review, then Save workouts.`
        : 'Nothing landed in the seven days shown.',
    ]
    if (outside.length) notes.push(`Skipped ${outside.join(', ')}: past the seven days shown.`)
    if (parsed.skipped.length) notes.push(`Ignored rows without a weekday: ${parsed.skipped.join(', ')}.`)
    setPasteMessage(notes.join(' '))

    if (filled.length) {
      setPasteText('')
      setIsPasting(false)
    }
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
      setIsPasting(false)
      setPasteMessage('')
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
              className="secondary-action weekly-paste-btn"
              aria-expanded={isExpanded && isEditing && isPasting}
              onClick={() => {
                setIsExpanded(true)
                setIsEditing(true)
                setIsPasting((value) => !value)
                setPasteMessage('')
              }}
              disabled={!idToken || isWriting}
            >
              Paste plan
            </button>
          ) : null}
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
                  setIsPasting(false)
                  setPasteMessage('')
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
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${title}`}
            onClick={() => setIsExpanded((value) => !value)}
          >
            <ChevronDown size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </div>

      {isLoading ? <p className="sheets-meta">Loading workouts...</p> : null}

      {!isLoading && isExpanded ? (
        <>
          {isEditing && isPasting ? (
            <div className="weekly-paste">
              <label htmlFor="weekly-paste-input">
                Paste a Day / Morning / Afternoon or Evening table, or mobile day cards with workout labels. Days fill from today forward.
              </label>
              <textarea
                id="weekly-paste-input"
                className="sheets-input"
                rows={7}
                value={pasteText}
                placeholder={PASTE_PLACEHOLDER}
                onChange={(event) => setPasteText(event.target.value)}
              />
              <div className="weekly-paste-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setIsPasting(false)
                    setPasteText('')
                    setPasteMessage('')
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="secondary-action"
                  onClick={handleFillFromPaste}
                  disabled={!pasteText.trim()}
                >
                  Fill table
                </button>
              </div>
            </div>
          ) : null}
          {isEditing && pasteMessage ? (
            <p className="sheets-meta" role="status">
              {pasteMessage}
            </p>
          ) : null}

          <div className="sheets-table-shell weekly-reset-table-shell">
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
                          <textarea
                            className="sheets-input sheets-table-input weekly-reset-input"
                            aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long' })} morning workout`}
                            rows={Math.max(1, draft.morning.split('\n').length)}
                            value={draft.morning}
                            onChange={(event) => setDraftValue(key, 'morning', event.target.value)}
                            disabled={!canWrite || !idToken || isWriting}
                          />
                        ) : (
                          <WorkoutText value={draft.morning} />
                        )}
                      </td>
                      <td data-label="Evening workout">
                        {isEditing ? (
                          <textarea
                            className="sheets-input sheets-table-input weekly-reset-input"
                            aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long' })} evening workout`}
                            rows={Math.max(1, draft.evening.split('\n').length)}
                            value={draft.evening}
                            onChange={(event) => setDraftValue(key, 'evening', event.target.value)}
                            disabled={!canWrite || !idToken || isWriting}
                          />
                        ) : (
                          <WorkoutText value={draft.evening} />
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
  isTrueAdmin,
  viewAsGuest,
  onToggleGuestView,
}: {
  profile: UserProfile
  googleIdToken: string
  onGoogleTokenChange: (token: string) => void
  isTrueAdmin: boolean
  viewAsGuest: boolean
  onToggleGuestView: () => void
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
          <p className="summary-line">
            Current profile: {viewAsGuest ? 'GUEST VIEW (admin)' : profile.toUpperCase()}
          </p>
          {isTrueAdmin ? (
            <button type="button" className="secondary-action" onClick={onToggleGuestView}>
              {viewAsGuest ? 'Return to admin view' : 'View site as guest'}
            </button>
          ) : null}
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
