import type { AdminDashboardId, AdminDashboardMeta } from './shared'

/**
 * The admin nav. Order here drives the icon bar in the top bar — there is no
 * hamburger menu and no section list once you are signed in as admin.
 *
 * Tasks sits in the middle of the bar and is where an admin lands. Content keeps
 * the verse, the 365 challenges and WW + TG; Training has the day's training on
 * top of the data and the log; Overview holds Health and News as tabs.
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
    id: 'content',
    title: 'Content',
    path: '/admin/content',
    icon: 'content',
    summary: 'Verse of the day, the 365 challenges, and WW + TG',
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
    id: 'training',
    title: 'Training',
    path: '/admin/training',
    icon: 'training',
    summary: "Today's training, workouts, and the training log",
    accent: '#f97316',
    eyebrow: 'Fitness',
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
