import type { AdminDashboardId, AdminDashboardMeta } from './shared'

/**
 * The admin nav. Order here drives the icon bar in the top bar — there is no
 * hamburger menu and no section list once you are signed in as admin.
 *
 * Home keeps chores and training; tasks, calendar and emails each get a
 * bare page of their own.
 */
export const adminDashboards: AdminDashboardMeta[] = [
  {
    id: 'home',
    title: 'Home',
    path: '/',
    icon: 'home',
    summary: "Chores and today's training",
    accent: '#00cccc',
    eyebrow: 'Daily driver',
  },
  {
    id: 'tasks',
    title: 'Tasks',
    path: '/admin/tasks',
    icon: 'tasks',
    summary: 'Tasks of the day from Todoist',
    accent: '#00cccc',
    eyebrow: 'Todoist',
  },
  {
    id: 'calendar',
    title: 'Calendar',
    path: '/admin/calendar',
    icon: 'calendar',
    summary: 'The month and week ahead, with the weather',
    accent: '#3b82f6',
    eyebrow: 'Schedule',
  },
  {
    id: 'emails',
    title: 'Emails',
    path: '/admin/emails',
    icon: 'emails',
    summary: 'The inbox summary',
    accent: '#8b5cf6',
    eyebrow: 'Inbox',
  },
  {
    id: 'personal',
    title: 'Personal',
    path: '/admin/personal',
    icon: 'personal',
    summary: 'Verse of the day, journal entries with gratitude, mood against sleep, and daily wellness',
    accent: '#a855f7',
    eyebrow: 'Writing',
  },
  {
    id: 'health',
    title: 'Health',
    path: '/admin/health',
    icon: 'health',
    summary: 'Garmin workouts, runs, swims, and rides, plus the training log and PRs',
    accent: '#14b8a6',
    eyebrow: 'Body',
  },
  {
    id: 'news',
    title: 'News',
    path: '/admin/news',
    icon: 'news',
    summary: 'Local, city, national, international, and tech headlines',
    accent: '#f59e0b',
    eyebrow: 'Headlines',
  },
  {
    id: 'ciara',
    title: 'WW+TG',
    path: '/admin/ciara',
    icon: 'ciara',
    summary: 'Time together and a photo timeline',
    accent: '#ef4444',
    eyebrow: 'Ciara',
  },
]

export const adminDashboardsById: Record<AdminDashboardId, AdminDashboardMeta> =
  Object.fromEntries(adminDashboards.map((dashboard) => [dashboard.id, dashboard])) as Record<
    AdminDashboardId,
    AdminDashboardMeta
  >
