import type { AdminDashboardId, AdminDashboardMeta } from './shared'

/**
 * The admin nav. Order here drives the icon bar in the top bar — there is no
 * hamburger menu and no section list once you are signed in as admin.
 *
 * Home is the daily driver: tasks, yesterday's recap, inbox, and the week's
 * calendar all on one screen, so it replaces the old /admin tile hub.
 */
export const adminDashboards: AdminDashboardMeta[] = [
  {
    id: 'home',
    title: 'Home',
    path: '/',
    icon: 'home',
    summary: "Today's tasks, yesterday's recap, inbox, and the week ahead",
    accent: '#ef4444',
    eyebrow: 'Daily driver',
    intro: '',
    note: '',
  },
  {
    id: 'journal',
    title: 'Journal',
    path: '/admin/journal',
    icon: 'journal',
    summary: 'Daily entries, mood, and what the day was actually about',
    accent: '#a855f7',
    eyebrow: 'Writing',
    intro:
      'One entry per day. Short is fine — the point is having something to look back on, not producing an essay.',
    note: 'Entries are stored in the private journal sheet and are never rendered for signed-out visitors.',
  },
  {
    id: 'finance',
    title: 'Finance',
    path: '/admin/finance',
    icon: 'finance',
    summary: 'Budget targets, spending by category, and the money calendar',
    accent: '#16a34a',
    eyebrow: 'Money',
    intro:
      'Monthly totals against targets, spending broken out by category and by person, and the recurring bills and paydays laid out on a calendar.',
    note: 'Visible only to approved Google accounts.',
  },
  {
    id: 'training',
    title: 'Training',
    path: '/admin/training',
    icon: 'training',
    summary: 'Garmin, Apple Health, and RingConn data plus the session log',
    accent: '#14b8a6',
    eyebrow: 'Body',
    intro:
      'Everything the wearables produce, in one place: sleep and recovery from RingConn, activities and load from Garmin, and the Apple Health baseline underneath both — alongside the session log and the next event on the calendar.',
    note: 'Single days are noise. Read anything here as a multi-week trend.',
  },
  {
    id: 'work',
    title: 'Work',
    path: '/admin/work',
    icon: 'work',
    summary: 'Active projects, deadlines, and the links I open every morning',
    accent: '#f97316',
    eyebrow: 'Day job',
    intro:
      'What is in flight at work, what is due next, and the handful of tools and dashboards that get opened every morning anyway.',
    note: 'Deliberately light on detail — nothing client-identifying belongs in a browser tab.',
  },
]

export const adminDashboardsById: Record<AdminDashboardId, AdminDashboardMeta> =
  Object.fromEntries(adminDashboards.map((dashboard) => [dashboard.id, dashboard])) as Record<
    AdminDashboardId,
    AdminDashboardMeta
  >
