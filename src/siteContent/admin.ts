import type { AdminDashboardId, AdminDashboardMeta } from './shared'

/**
 * The admin nav. Order here drives the icon bar in the top bar — there is no
 * hamburger menu and no section list once you are signed in as admin.
 *
 * Tasks sits in the middle and is where an admin lands. Projects keeps the verse,
 * daily wellness and the 90-day Progress tracker; Training has the day's training
 * on top of the data and the log; News is the headlines.
 */
export const adminDashboards: AdminDashboardMeta[] = [
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
    id: 'projects',
    title: 'Projects',
    path: '/admin/projects',
    icon: 'projects',
    summary: 'Verse of the day, daily wellness, and the 90-day Progress tracker',
    accent: '#00cccc',
    eyebrow: 'Goals',
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
    id: 'training',
    title: 'Training',
    path: '/admin/training',
    icon: 'training',
    summary: "Today's training, workouts, and the training log",
    accent: '#f97316',
    eyebrow: 'Fitness',
  },
  {
    id: 'news',
    title: 'News',
    path: '/admin/news',
    icon: 'news',
    summary: 'Local, city, national, international and tech headlines, plus WW + TG',
    accent: '#14b8a6',
    eyebrow: 'Headlines',
  },
]

export const adminDashboardsById: Record<AdminDashboardId, AdminDashboardMeta> =
  Object.fromEntries(adminDashboards.map((dashboard) => [dashboard.id, dashboard])) as Record<
    AdminDashboardId,
    AdminDashboardMeta
  >
