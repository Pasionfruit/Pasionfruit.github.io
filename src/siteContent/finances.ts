import type { NavSection, PageContent } from './shared'

export const financesNavSection: NavSection = {
  id: 'finances',
  title: 'Finances',
  path: '/finances',
  summary: 'Private budget, savings, and spending overview for approved accounts',
  accent: '#1f8f3a',
  children: [],
}

export const financesSectionPage: PageContent = {
  eyebrow: 'Private snapshot',
  title: 'Finances',
  summary: 'A private view of budget, savings, and purchases for approved Google accounts only.',
  accent: '#1f8f3a',
  cards: [
    {
      title: 'Dashboard',
      body: 'Monthly totals, savings progress, and quick financial health checks.',
    },
    {
      title: 'Calendar',
      body: 'Recurring bills, paydays, due dates, and upcoming money events.',
    },
    {
      title: 'Purchases',
      body: 'Recent spending and categorized purchases for review.',
    },
  ],
  callout: '',
}