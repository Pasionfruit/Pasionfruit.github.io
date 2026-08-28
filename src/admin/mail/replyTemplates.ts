/**
 * Canned reply openers, used to seed a Gmail draft.
 *
 * Placeholder until the self-hosted model is wired up — at that point these
 * become the fallback for when generation is unavailable, rather than the only
 * option. `{{sender}}` is substituted with the sender's first name.
 */
export type ReplyTemplate = {
  id: string
  label: string
  body: string
}

export const REPLY_TEMPLATES: ReplyTemplate[] = [
  {
    id: 'ack',
    label: 'Acknowledge',
    body: 'Hi {{sender}},\n\nThanks for this — got it, and I will take a look.\n\nAbe',
  },
  {
    id: 'will-reply',
    label: 'Reply later',
    body: 'Hi {{sender}},\n\nThanks for reaching out. I am tied up at the moment but will come back to you properly by the end of the week.\n\nAbe',
  },
  {
    id: 'need-info',
    label: 'Need more info',
    body: 'Hi {{sender}},\n\nHappy to help with this. Before I do, could you send over:\n\n- \n- \n\nThanks,\nAbe',
  },
  {
    id: 'schedule',
    label: 'Propose a call',
    body: 'Hi {{sender}},\n\nThis is probably easier on a call than over email. Would either of these work?\n\n- \n- \n\nHappy to work around you if not.\n\nAbe',
  },
  {
    id: 'decline',
    label: 'Politely decline',
    body: 'Hi {{sender}},\n\nThanks for thinking of me. I do not have the capacity to take this on right now, so I will pass — but I appreciate the offer.\n\nAbe',
  },
  {
    id: 'blank',
    label: 'Blank draft',
    body: 'Hi {{sender}},\n\n\n\nAbe',
  },
]

/** First name from a From header like `"Jane Doe" <jane@x.com>`. */
export function senderFirstName(from: string): string {
  const quoted = /^\s*"?([^"<]*)"?\s*</.exec(from)?.[1]?.trim()
  const name = quoted || from.split('@')[0].replace(/[<>]/g, '').trim()
  const first = name.split(/[\s.]+/)[0]

  if (!first) {
    return 'there'
  }

  return first.charAt(0).toUpperCase() + first.slice(1)
}

export function fillTemplate(template: ReplyTemplate, from: string): string {
  return template.body.replace(/\{\{sender\}\}/g, senderFirstName(from))
}
