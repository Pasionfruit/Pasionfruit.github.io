import type { NavSection, PageContent, SubpageContent } from './shared'

export const trainingNavSection: NavSection = {
  id: 'training',
  title: 'Training',
  path: '/training',
  summary: 'Records, data, and learning resources to understand and track progress ',
  accent: '#FC5200',
  children: [
    {
      label: 'Records',
      path: '/training/records',
      summary: 'Overall PRs of my training sessions (be nice plz)',
    },
    {
      label: 'Training Data Analysis',
      path: '/training/data',
      summary: 'How I analyze personal charts and metrics',
    },
    //   {
    //     label: 'Learn',
    //     path: '/training/learn',
    //     summary: 'Coaches are cool, but I want to understand the why behind the work, not just the what.',
    //   },
  ],
}

export const trainingSectionPage: PageContent = {
  eyebrow: 'Progress tracking',
  title: 'Training',
  summary:
    'Stats of the slow times and weak lifts\n• Strava: https://www.strava.com/athletes/116157184\n• Instagram: @mrpasionfruit',
  accent: '#14b8a6',
  cards: [
    {
      title: 'Next Event Countdown',
      body: '',
    },
    {
      title: 'Training Log',
      body: 'Filterable by season and year',
    },

  ],
  callout: '',
}

export const trainingDetailPages: Record<string, SubpageContent> = {
  '/training/records': {
    eyebrow: 'Session log',
    title: 'Training Records',
    summary: 'Day 1 or 1 Day',
    accent: '#14b8a6',
    cards: [
      { title: 'Consistency', body: 'Github chart of training over time' },
      { title: 'Milestones', body: 'Track the lifts or benchmarks that matter most over time.' },
      { title: 'Equipment', body: 'Gear, shoes, and nutrition used in training.' },
      { title: 'Week Plans', body: 'Chart of Mon - Sun Morning and Evening sessions, completed?' },
      { title: 'Previous Events', body: 'Scrolling filterable list of previous Events' },
    ],
    note: '',
  },
  '/training/data': {
    eyebrow: 'Numbers and trends',
    title: 'Training Data Analysis',
    summary: 'Charts and metrics that make the overall trend easy to understand at a glance.',
    accent: '#14b8a6',
    cards: [
      { title: 'Health Data', body: 'Ingested data from Garmin, Ringconn, and Apple Health' },
      { title: 'Health Data Terms', body: 'Filterable list of health data terms and their definitions' },
      { title: 'Tools', body: 'Tools on calculating and visualizing training data' },
      { title: 'Learning', body: 'Gemini Notebook with resources and top recommended videos' },
    ],
    note: 'Keep this page readable first and analytical second.',
  },
  //   '/training/learn': {
  //     eyebrow: 'Technique notes',
  //     title: 'Training Learn',
  //     summary: 'A notebook for what I am learning, what failed, and what to try differently next.',
  //     accent: '#14b8a6',
  //     cards: [
  //       { title: 'Cues', body: 'Capture short reminders that help during the next session.' },
  //       { title: 'Mistakes', body: 'List the things that went wrong so the next cycle starts sharper.' },
  //       { title: 'Experiments', body: 'Record small changes and the result so learning stays practical.' },
  //     ],
  //     note: 'This page is ideal for small notes that accumulate into a training philosophy.',
  //   },
}
