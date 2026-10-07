import type { NavSection, PageContent } from './shared'

export const trainingNavSection: NavSection = {
  id: 'training',
  title: 'Training',
  path: '/#training',
  summary: "Today's workout, the training log, and the next event",
  accent: '#3a86ff',
  children: [],
}

export const trainingSectionPage: PageContent = {
  eyebrow: 'Today',
  title: 'Training',
  summary: "Today's planned workout, the activities I've logged, and the countdown to my next event.",
  accent: '#3a86ff',
  cards: [],
  callout: '',
}
