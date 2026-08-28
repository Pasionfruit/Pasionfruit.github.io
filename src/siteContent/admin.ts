import type { AdminDashboardId, AdminDashboardMeta } from './shared'

/**
 * The admin nav. Order here drives the icon bar in the top bar — there is no
 * hamburger menu and no section list once you are signed in as admin.
 *
 * Home is the daily driver: the week's calendar, tasks, yesterday's recap, and
 * the inbox all on one screen, so it replaces the old /admin tile hub.
 */
export const adminDashboards: AdminDashboardMeta[] = [
  {
    id: 'home',
    title: 'Home',
    path: '/',
    icon: 'home',
    summary: "The week ahead, today's tasks, yesterday's recap, and the inbox",
    accent: '#00cccc',
    eyebrow: 'Daily driver',
  },
  {
    id: 'personal',
    title: 'Personal',
    path: '/admin/personal',
    icon: 'personal',
    summary: 'Journal entries, mood, gratitude, and a breathing timer',
    accent: '#a855f7',
    eyebrow: 'Writing',
  },
  {
    id: 'finance',
    title: 'Finance',
    path: '/admin/finance',
    icon: 'finance',
    summary: 'Budget targets, spending by category, and the money calendar',
    accent: '#16a34a',
    eyebrow: 'Money',
  },
  {
    id: 'health',
    title: 'Health',
    path: '/admin/health',
    icon: 'health',
    summary: 'Garmin, Apple Health, and RingConn data plus the session log',
    accent: '#14b8a6',
    eyebrow: 'Body',
  },
  {
    id: 'work',
    title: 'Work',
    path: '/admin/work',
    icon: 'work',
    summary: 'Active projects, deadlines, and the links I open every morning',
    accent: '#f97316',
    eyebrow: 'Day job',
  },
]

export const adminDashboardsById: Record<AdminDashboardId, AdminDashboardMeta> =
  Object.fromEntries(adminDashboards.map((dashboard) => [dashboard.id, dashboard])) as Record<
    AdminDashboardId,
    AdminDashboardMeta
  >
