import type { NavSection, PageContent, SubpageContent } from './shared'

export const gamingNavSection: NavSection = {
  id: 'gaming',
  title: 'Gaming',
  path: '/gaming',
  summary: 'A hub for my favorite games and gaming servers.',
  accent: '#9333ea',
  children: [
    {
      label: 'Minecraft',
      path: '/gaming/server',
      summary: 'Start the Minecraft server, log your name, and get connection info.',
    },
  ],
}

export const gamingSectionPage: PageContent = {
  eyebrow: 'Game hub',
  title: 'Gaming',
  summary: 'A hub for my favorite games and gaming servers',
  accent: '#7e22ce',
  cards: [
    { title: 'Games I Like to Play', body: '' },
  ],
  callout: '',
}

export const gamingDetailPages: Record<string, SubpageContent> = {
  '/gaming/server': {
    eyebrow: 'Minecraft',
    title: 'Server',
    summary: 'Start the Aternos server and get connection instructions.',
    accent: '#7e22ce',
    cards: [],
    note: '',
  },
}
