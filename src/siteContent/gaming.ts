import type { NavSection, PageContent } from './shared'

export const gamingNavSection: NavSection = {
  id: 'gaming',
  title: 'Gaming',
  path: '/#gaming',
  summary: 'Status and controls for the Minecraft server I run for friends',
  accent: '#e76f51',
  children: [],
}

export const gamingSectionPage: PageContent = {
  eyebrow: 'Game hub',
  title: 'Gaming',
  summary:
    'Locally hosted Minecraft server, configured to shut down when it is empty for 5 minutes and has to be started before anyone can connect. Check the status below, start it from the control dashboard if it is offline, then join with the address in the connection guide.',
  accent: '#e76f51',
  cards: [],
  callout: 'Startup usually takes a minute or two, Please read the connection guide before trying to connect.',
}
