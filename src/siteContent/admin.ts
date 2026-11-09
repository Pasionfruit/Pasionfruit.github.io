import type { AdminDashboardId, AdminDashboardMeta } from './shared'

/**
 * The admin nav. Order here drives the icon bar in the top bar — there is no
 * hamburger menu and no section list once you are signed in as admin.
 *
 * Home sits in the middle of the bar. It keeps the verse, training, chores and
 * WW + TG; tasks and calendar each get a bare page of their own, and Overview
 * holds Health and News as tabs.
 */
export const adminDashboards: AdminDashboardMeta[] = [
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
    id: 'home',
    title: 'Home',
    path: '/',
    icon: 'home',
    summary: "Verse of the day, today's training, chores, and WW + TG",
    accent: '#00cccc',
    eyebrow: 'Daily driver',
  },
  {
    id: 'personal',
    title: 'Journal',
    path: '/admin/personal',
    icon: 'personal',
    summary: 'Journal entries with gratitude',
    accent: '#a855f7',
    eyebrow: 'Writing',
  },
  {
    id: 'overview',
    title: 'Overview',
    path: '/admin/overview',
    icon: 'overview',
    summary: 'Health data and the news headlines',
    accent: '#14b8a6',
    eyebrow: 'Health and news',
  },
]

export const adminDashboardsById: Record<AdminDashboardId, AdminDashboardMeta> =
  Object.fromEntries(adminDashboards.map((dashboard) => [dashboard.id, dashboard])) as Record<
    AdminDashboardId,
    AdminDashboardMeta
  >
