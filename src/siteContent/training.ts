import type { NavSection, PageContent, SubpageContent } from './shared'

export const trainingNavSection: NavSection = {
  id: 'training',
  title: 'Training',
  path: '/training',
  summary: 'Records, data, and learning resources to understand and track progress ',
  accent: '#14b8a6',
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
    'Training around a full-time job means most weeks are a compromise, so I log what actually happened instead of what the plan said. These pages hold the session log, the personal bests, and the data analysis I use to tell a real trend from a bad week.\n• Strava: https://www.strava.com/athletes/116157184\n• Instagram: @mrpasionfruit',
  accent: '#14b8a6',
  cards: [
    {
      title: 'Next Event Countdown',
      body: 'Time remaining until the next race or event I am training toward.',
    },
    {
      title: 'Training Log',
      body: 'Every logged session, filterable by season and year.',
    },
  ],
  callout:
    'Nothing here is impressive on its own — the point is consistency over a long enough window that the trend means something. Slow times and light lifts still count as data.',
}

export const trainingDetailPages: Record<string, SubpageContent> = {
  '/training/records': {
    eyebrow: 'Session log',
    title: 'Training Records',
    summary:
      'Personal bests and the history behind them. The individual numbers matter less than whether the work is showing up week after week, so consistency gets as much space here as the records do.',
    accent: '#14b8a6',
    cards: [
      {
        title: 'Consistency',
        body: 'A contribution-style grid of training days over time. The gaps are as informative as the streaks — most of them line up with work crunches or travel.',
      },
      {
        title: 'Milestones',
        body: 'The lifts and benchmarks I actually track, with how they have moved over time.',
      },
      {
        title: 'Equipment',
        body: 'Shoes, gear, and nutrition I have settled on, including what I have replaced and why.',
      },
      {
        title: 'Week Plans',
        body: 'The Monday-through-Sunday layout of morning and evening sessions, and whether each one actually got done.',
      },
      {
        title: 'Previous Events',
        body: 'Races and events already completed, with results and what I would do differently.',
      },
    ],
    note: 'Records update as sessions sync, so a recent PR may take a day to appear here.',
  },
  '/training/data': {
    eyebrow: 'Numbers and trends',
    title: 'Training Data Analysis',
    summary:
      'Wearables produce far more data than is useful. This page is where I work out which metrics actually predict how a session goes, what the terminology means in plain language, and how to read a trend without over-fitting to a single bad night of sleep.',
    accent: '#14b8a6',
    cards: [
      {
        title: 'Health Data',
        body: 'Sleep, heart rate, recovery, and workload pulled from Garmin, RingConn, and Apple Health, charted over time.',
      },
      {
        title: 'Health Data Terms',
        body: 'Plain-language definitions for the metrics these devices report — HRV, training load, VO2 max estimates, and the rest — including how much to trust each one.',
      },
      {
        title: 'Tools',
        body: 'The calculators and visualizations I use to turn raw exports into something readable.',
      },
      {
        title: 'Learning',
        body: 'A Gemini notebook of the sources and videos that actually changed how I interpret this data.',
      },
    ],
    note: 'Single days are noise. Anything on this page is worth reading as a multi-week trend, not a daily score.',
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
