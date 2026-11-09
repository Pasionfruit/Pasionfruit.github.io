import type { AdminDashboardId, AdminDashboardMeta } from './shared'

/**
 * The admin nav. Order here drives the icon bar in the top bar — there is no
 * hamburger menu and no section list once you are signed in as admin.
 *
 * Home keeps the verse, chores and training; tasks and calendar each get a
 * bare page of their own.
 */
export const adminDashboards: AdminDashboardMeta[] = [
  {
    id: 'home',
    title: 'Home',
    path: '/',
    icon: 'home',
    summary: "Verse of the day, chores, and today's training",
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
    id: 'personal',
    title: 'Personal',
    path: '/admin/personal',
    icon: 'personal',
    summary: 'Journal entries with gratitude',
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
