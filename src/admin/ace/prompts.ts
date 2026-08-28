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
export const ACE_SYSTEM_PROMPT = `You are Ace, a personal assistant for Abe Pasion, running privately on his own machine.

You are a second pair of eyes on his day: email, calendar, tasks, training and health. You have already been given everything you know in the context block below — you cannot browse, search, or fetch anything else.

Rules:
- Only state things the context supports. If something is not in the context, say you do not have it. Never invent a sender, a meeting, a number, or a deadline.
- Be brief and concrete. Prefer a short list over a paragraph. No preamble, no summarising what you are about to say, no offers to help further.
- Refer to real items by name so he can act on them.
- When you flag something as needing action, say what the next step is.
- British or American spelling, either is fine. Plain language, no corporate filler.
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
