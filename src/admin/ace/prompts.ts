/**
 * Prompts and schemas for Assistant Ace.
 *
 * Kept apart from the client and the card so they can be reworded without
 * touching either — prompt tuning is the part of this that will actually change
 * week to week.
 */

/**
 * The standing instructions. Two things matter most at this model size: refuse
 * to invent facts the context does not contain, and stay short. A local 8B
 * model padding three paragraphs onto a two-line answer is the failure mode
 * that makes an assistant like this get ignored.
 */
export const ACE_SYSTEM_PROMPT = `You are Ace, Abe Pasion's personal assistant, running privately on his own machine.

You are a second pair of eyes on his day: email, calendar, tasks, training and health. Everything you know is in the context block below — you cannot browse, search, or fetch anything else.

Voice and tone:
- Sound like a sharp, friendly chief of staff: warm, direct, human. A light touch of personality is welcome; flattery and filler are not.
- Talk to Abe in the second person ("you have three things today"), never about him in the third.
- Be brief and concrete. Short lists beat paragraphs. No preamble, no recap of the question, no offers to help further.

Formatting:
- Use **bold** for names, senders and the key item of a line.
- Use hyphen bullets for lists; keep each bullet to one line where possible.
- One short opening line is fine before a list; skip headings except in the morning briefing.

Rules:
- Only state things the context supports. If something is not in the context, say you do not have it. Never invent a sender, a meeting, a number, or a deadline.
- Refer to real items by name so he can act on them.
- When you flag something as needing action, say what the next step is.
- You cannot send email or change his calendar. You can suggest a reminder, which he confirms before it is created.`

/**
 * The morning briefing. Asks for fixed section headings so the card can render
 * a predictable shape, and explicitly permits omitting a section — otherwise a
 * small model pads empty sections with invented content.
 */
export const MORNING_REPORT_PROMPT = `Write Abe's morning briefing from the context.

Use exactly these sections, in this order, and skip any section that has nothing real to report:

**Overnight** — what arrived or changed since yesterday evening that he has not seen.
**Needs a reply** — specific emails that want an answer, with who and what they want. If none, skip.
**Today** — his schedule and the handful of tasks that actually matter today, in the order they make sense to do.
**Carried over** — anything that slipped yesterday and is now late.
**Body** — last night's sleep and recovery, and what it implies for training today. If there is no watch data, skip.

Keep the whole thing under 200 words. Lead with the single most important thing.`

/**
 * The evening review: verify the day, surface what slipped, set up tomorrow.
 * Same fixed-section contract as the morning briefing.
 */
export const EVENING_REPORT_PROMPT = `Write Abe's evening review from the context.

Use exactly these sections, in this order, and skip any section that has nothing real to report:

**Done today** — what he completed today; open with the count, then the items worth naming.
**Still open** — tasks due today or overdue that never got checked off. Be direct about what slipped. If everything got done, replace this section with one short line of earned credit.
**Tomorrow** — tasks due tomorrow and tomorrow's calendar, in the order they make sense to tackle.
**Before bed** — one practical wind-down note: an unread email worth a reply, a five-minute task worth closing now, or nothing at all.

Keep the whole thing under 180 words. No invented items.`

/** JSON schema for reminder extraction; enforced by Ollama's structured output. */
export const REMINDER_SCHEMA = {
  type: 'object',
  properties: {
    isReminder: {
      type: 'boolean',
      description: 'True only if the note describes something to do or remember later.',
    },
    content: {
      type: 'string',
      description: 'The task, phrased as a short imperative. Empty if isReminder is false.',
    },
    dueDate: {
      type: 'string',
      description: 'Due date as YYYY-MM-DD, or an empty string if the note implies no date.',
    },
    priority: {
      type: 'integer',
      description: '1 normal, 3 important, 4 urgent.',
      minimum: 1,
      maximum: 4,
    },
  },
  required: ['isReminder', 'content', 'dueDate', 'priority'],
} as const

/** JSON schema for matching "I did X" against a real open task. */
export const COMPLETION_SCHEMA = {
  type: 'object',
  properties: {
    isCompletion: {
      type: 'boolean',
      description: 'True only if the message reports that a task was finished or done.',
    },
    taskId: {
      type: 'string',
      description: 'The id of the one open task the message refers to, or an empty string if none match.',
    },
  },
  required: ['isCompletion', 'taskId'],
} as const

export type CompletionDraft = {
  isCompletion: boolean
  taskId: string
}

export function completionExtractionPrompt(message: string, tasks: { id: string; content: string }[]) {
  const list = tasks.map((task) => `- id: ${task.id} | ${task.content}`).join('\n')

  return `Abe said:
"""
${message}
"""

If he is reporting that he finished, did, or completed something, pick the ONE open task below he means. Match on meaning, not exact wording. If he is asking a question, making a request, or nothing below plausibly matches, set isCompletion to false and taskId to an empty string. Never guess a taskId that is not in the list.

Open tasks:
${list}`
}

/** JSON schema for matching "I addressed that email" against real inbox mail. */
export const ARCHIVE_SCHEMA = {
  type: 'object',
  properties: {
    isArchive: {
      type: 'boolean',
      description: 'True only if the message says an email has been handled, replied to, or is done with.',
    },
    threadId: {
      type: 'string',
      description: 'The threadId of the one mail item the message refers to, or an empty string if none match.',
    },
  },
  required: ['isArchive', 'threadId'],
} as const

export type ArchiveDraft = {
  isArchive: boolean
  threadId: string
}

export function archiveExtractionPrompt(
  message: string,
  mail: { threadId: string; from: string; subject: string }[],
) {
  const list = mail.map((item) => `- threadId: ${item.threadId} | from ${item.from} | "${item.subject}"`).join('\n')

  return `Abe said:
"""
${message}
"""

If he is saying he has addressed, replied to, handled, or finished with an email, pick the ONE inbox item below he means. Match on sender or subject meaning, not exact wording. If he is asking a question, or nothing below plausibly matches, set isArchive to false and threadId to an empty string. Never guess a threadId that is not in the list.

Inbox:
${list}`
}

export type ReminderDraft = {
  isReminder: boolean
  content: string
  dueDate: string
  priority: number
}

export function reminderExtractionPrompt(note: string, todayIso: string) {
  return `Today is ${todayIso}.

Turn this note into a single task if it describes something to do or remember. If it is a question, an observation, or small talk, set isReminder to false.

Resolve relative dates against today. "Tomorrow" is the day after ${todayIso}. If no timing is implied, leave dueDate empty rather than guessing.

Note:
"""
${note}
"""`
}
