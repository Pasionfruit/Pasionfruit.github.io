/**
 * Gratitude and reflection prompts for the journal entry form.
 *
 * The prompt rotates daily so entries do not all answer the same question, and
 * the question text is stored alongside the answer — otherwise an old entry
 * would render under whatever prompt happens to fall on that date later.
 */

export const GRATITUDE_PROMPTS: string[] = [
  'What is one small thing today that went better than expected?',
  'Who made your day easier, and did they know it?',
  'What do you have today that you were once hoping for?',
  'What is something ordinary you would miss if it were gone?',
  'What did your body let you do today?',
  'What is one thing you learned, however small?',
  'Which part of today would you happily live again?',
  'What went wrong that could have gone much worse?',
  'What is something you own that has quietly earned its keep?',
  'Who would you thank if there were no awkwardness in it?',
  'What did you eat, see, or hear today that was genuinely good?',
  'What problem do you have today that is a better problem than last year’s?',
  'What is one thing you did today that your past self would be glad about?',
  'Where did you get help you did not ask for?',
  'What is something about where you live that you are glad of?',
  'What did you finish today, even if it was small?',
  'What made you laugh recently?',
  'What is a skill you have that you no longer notice using?',
  'Who has been patient with you lately?',
  'What is one comfort you had today that is not guaranteed?',
  'What went right that you had nothing to do with?',
  'What is something you were dreading that turned out fine?',
  'What do you appreciate about the work you did today?',
  'Which relationship are you glad is in your life right now?',
  'What is one thing you can do today that you could not do a year ago?',
  'What did you notice today that you usually walk past?',
  'What is something you are looking forward to?',
  'Where did you show up even though it was hard?',
  'What is a mistake you made that you are glad you made?',
  'What is quietly going well that you have not stopped to acknowledge?',
]

/** Days since the epoch in local time, so the prompt turns over at local midnight. */
function dayIndex(date: Date) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  return Math.floor(local.getTime() / 86_400_000)
}

export function getPromptOfTheDay(date = new Date()): string {
  const length = GRATITUDE_PROMPTS.length
  return GRATITUDE_PROMPTS[((dayIndex(date) % length) + length) % length]
}

/** How many "grateful for" lines the entry form asks for. */
export const GRATITUDE_LINE_COUNT = 3
