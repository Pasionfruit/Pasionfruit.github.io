import type { AdminDashboardId, AdminDashboardMeta } from './shared'

/**
 * The private dashboards. Order here drives both the /admin tile grid and the
 * admin block in the side menu.
 */
export const adminDashboards: AdminDashboardMeta[] = [
  {
    id: 'tasks',
    title: 'Tasks',
    path: '/admin/tasks',
    summary: "Today's tasks, what yesterday actually looked like, and inbox triage",
    accent: '#ef4444',
    eyebrow: 'Daily driver',
    intro:
      "Everything due today in one place, a recap of what closed yesterday so nothing quietly slips, and a summary of the mail worth answering.",
    note: 'Task data comes from Todoist. Mail is read-only — nothing here sends or archives on your behalf.',
  },
  {
    id: 'calendar',
    title: 'Calendar',
    path: '/admin/calendar',
    summary: 'Google and Apple calendars merged into one week',
    accent: '#6366f1',
    eyebrow: 'Schedule',
    intro:
      'Work and personal calendars overlaid on the same week, so a training block and a meeting cannot quietly land on top of each other.',
    note: 'Read-only. Events are pulled from the connected calendars; edits still happen in the source app.',
  },
  {
    id: 'journal',
    title: 'Journal',
    path: '/admin/journal',
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

export const adminHomeContent = {
  eyebrow: 'Private',
  title: 'Dashboards',
  summary:
    'The private side of the site. Six dashboards, each one pulling from whatever system already holds that data rather than asking me to re-enter it.',
  accent: '#7a62ff',
  note: 'Signed in as the admin account. Signing out returns the site to its public three sections.',
}
