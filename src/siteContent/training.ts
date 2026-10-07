import type { NavSection, PageContent } from './shared'

export const trainingNavSection: NavSection = {
  id: 'training',
  title: 'Training',
  path: '/#training',
  summary: 'The workouts planned for the next seven days',
  accent: '#3a86ff',
  children: [],
}

export const trainingSectionPage: PageContent = {
  eyebrow: 'This week',
  title: 'Training',
  summary: 'The workouts I have planned for the next seven days, morning and evening.',
  accent: '#3a86ff',
  cards: [],
  callout: '',
}
