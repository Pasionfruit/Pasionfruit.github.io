import { getCalendarEvents, getGarminWellness, getMail } from '../../data/sheets/repositories'
import type { CalendarEventRecord, MailSummaryRecord } from '../../data/sheets/repositories'
import type { GarminWellnessRecord } from '../../data/sheets/types'
import { getActiveTasks, getCompletedTasks } from '../../data/todoist/repositories'
import { addDaysToKey, dueDateKey, todayKey } from '../../data/todoist/dates'
import type { TodoistTask } from '../../data/todoist/types'

/**
 * Everything Ace is shown about the day, gathered client-side.
 *
 * Deliberately not a retrieval index. The volume here is a few dozen rows — it
 * fits in the prompt whole, which is both simpler and more faithful than a
 * vector store that has to be kept in sync with four different sources.
 *
 * Every field is optional in practice: any source can fail (Apps Script not
 * deployed, Todoist token missing, no watch data yet) and the briefing still
 * has to render, so failures are collected rather than thrown.
 */
export type AceContext = {
  now: Date
  mail: MailSummaryRecord[]
  events: CalendarEventRecord[]
  tasksToday: TodoistTask[]
  tasksOverdue: TodoistTask[]
  completedYesterday: TodoistTask[]
  slippedYesterday: TodoistTask[]
  wellness: GarminWellnessRecord | null
  /** Sources that failed, named for the UI so gaps are visible not silent. */
  gaps: string[]
}

const MAIL_LIMIT = 15

async function settle<T>(label: string, task: Promise<T>, gaps: string[], fallback: T): Promise<T> {
  try {
    return await task
  } catch {
    gaps.push(label)
    return fallback
  }
}

export async function buildAceContext(idToken: string, todoistConfigured: boolean): Promise<AceContext> {
  const gaps: string[] = []
  const now = new Date()
  const today = todayKey()
  const yesterday = addDaysToKey(today, -1)

  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const windowEnd = new Date(windowStart)
  windowEnd.setDate(windowEnd.getDate() + 7)

  const [mail, calendar, active, completedYesterday, wellness] = await Promise.all([
    idToken
      ? settle('Gmail', getMail(idToken, MAIL_LIMIT), gaps, [] as MailSummaryRecord[])
      : Promise.resolve([] as MailSummaryRecord[]),
    idToken
      ? settle(
          'Calendar',
          getCalendarEvents(idToken, windowStart, windowEnd),
          gaps,
          { events: [] as CalendarEventRecord[], errors: [], appleConfigured: false },
        )
      : Promise.resolve({ events: [] as CalendarEventRecord[], errors: [], appleConfigured: false }),
    todoistConfigured
      ? settle('Todoist', getActiveTasks(), gaps, [] as TodoistTask[])
      : Promise.resolve([] as TodoistTask[]),
    todoistConfigured
      ? settle('Todoist history', getCompletedTasks(yesterday, yesterday), gaps, [] as TodoistTask[])
      : Promise.resolve([] as TodoistTask[]),
    settle('Garmin', getGarminWellness(), gaps, [] as GarminWellnessRecord[]),
  ])

  return {
    now,
    mail,
    events: calendar.events,
    tasksToday: active.filter((task) => dueDateKey(task) === today),
    // Anything still open with a due date before today, newest first.
    tasksOverdue: active.filter((task) => {
      const key = dueDateKey(task)
      return Boolean(key) && key < today
    }),
    completedYesterday,
    slippedYesterday: active.filter((task) => dueDateKey(task) === yesterday),
    wellness: wellness[0] ?? null,
    gaps,
  }
}

function timeLabel(iso: string, allDay: boolean) {
  if (allDay) {
    return 'all day'
  }

  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function isToday(iso: string, now: Date) {
  const date = new Date(iso)
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function taskLine(task: TodoistTask) {
  const due = task.due?.date ? ` (due ${task.due.date})` : ''
  const priority = task.priority >= 3 ? ' [high priority]' : ''
  return `- ${task.content}${due}${priority}`
}

/**
 * The context rendered as plain text for the prompt.
 *
 * Written as terse labelled sections rather than JSON: small models follow a
 * readable outline more reliably than they parse nested objects, and it costs
 * fewer tokens.
 */
export function renderAceContext(context: AceContext) {
  const { now } = context
  const parts: string[] = []

  parts.push(
    `Today is ${now.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}. The current time is ${now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}.`,
  )

  const todaysEvents = context.events.filter((event) => isToday(event.start, now))
  const laterEvents = context.events.filter((event) => !isToday(event.start, now)).slice(0, 8)

  parts.push(
    `## Today's schedule\n${
      todaysEvents.length === 0
        ? 'Nothing scheduled today.'
        : todaysEvents
            .map((event) => `- ${timeLabel(event.start, event.allDay)} — ${event.title}${event.location ? ` @ ${event.location}` : ''}`)
            .join('\n')
    }`,
  )

  if (laterEvents.length > 0) {
    parts.push(
      `## Coming up this week\n${laterEvents
        .map((event) => `- ${new Date(event.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} — ${event.title}`)
        .join('\n')}`,
    )
  }

  parts.push(
    `## Unread and recent mail (${context.mail.filter((message) => message.unread).length} unread)\n${
      context.mail.length === 0
        ? 'No mail available.'
        : context.mail
            .slice(0, MAIL_LIMIT)
            .map(
              (message) =>
                `- ${message.unread ? '[unread] ' : ''}${message.important ? '[important] ' : ''}from ${message.from}: ${message.subject || '(no subject)'} — ${message.snippet.slice(0, 160)}`,
            )
            .join('\n')
    }`,
  )

  parts.push(
    `## Due today\n${
      context.tasksToday.length === 0 ? 'Nothing due today.' : context.tasksToday.map(taskLine).join('\n')
    }`,
  )

  if (context.tasksOverdue.length > 0) {
    parts.push(`## Overdue\n${context.tasksOverdue.slice(0, 15).map(taskLine).join('\n')}`)
  }

  parts.push(
    `## Yesterday\nCompleted ${context.completedYesterday.length}: ${
      context.completedYesterday.map((task) => task.content).join('; ') || 'nothing'
    }\nSlipped ${context.slippedYesterday.length}: ${
      context.slippedYesterday.map((task) => task.content).join('; ') || 'nothing'
    }`,
  )

  const wellness = context.wellness
  if (wellness) {
    const metrics = [
      wellness.sleep_score && `sleep score ${wellness.sleep_score}`,
      wellness.sleep_duration_h && `${wellness.sleep_duration_h}h asleep`,
      wellness.deep_sleep_h && `${wellness.deep_sleep_h}h deep`,
      wellness.rem_sleep_h && `${wellness.rem_sleep_h}h REM`,
      wellness.hrv && `HRV ${wellness.hrv}ms`,
      wellness.resting_hr && `resting HR ${wellness.resting_hr}bpm`,
      wellness.body_battery_high && `body battery peaked at ${wellness.body_battery_high}`,
      wellness.stress_avg && `average stress ${wellness.stress_avg}`,
      wellness.training_readiness && `training readiness ${wellness.training_readiness}`,
      wellness.training_status && `training status ${wellness.training_status}`,
    ].filter(Boolean)

    parts.push(`## Last night and recovery (${wellness.date})\n${metrics.join(', ') || 'No metrics recorded.'}`)
  }

  if (context.gaps.length > 0) {
    parts.push(
      `## Unavailable\nThese sources could not be read, so say nothing about them: ${context.gaps.join(', ')}.`,
    )
  }

  return parts.join('\n\n')
}
