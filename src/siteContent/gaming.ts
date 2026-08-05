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
  summary:
    'Gaming is the part of my week with no metrics attached, which is most of the appeal. This is a short list of what I actually play and the servers I keep running for friends.',
  accent: '#9333ea',
  cards: [
    {
      title: 'Games I Like to Play',
      body: 'The games currently in rotation, and the ones I keep reinstalling.',
    },
  ],
  callout:
    'The Minecraft server is the one thing here that needed real infrastructure — it runs on Aternos and sleeps when nobody is on it, so it has to be woken up before anyone can join.',
}

export const gamingDetailPages: Record<string, SubpageContent> = {
  '/gaming/server': {
    eyebrow: 'Minecraft',
    title: 'Server',
    summary:
      'The server runs on Aternos, which means it shuts down when it is empty and has to be started before anyone can connect. Check the status below, start it if it is offline, wait for it to finish booting, then join with the address shown.',
    accent: '#9333ea',
    cards: [],
    note: 'Startup usually takes a minute or two. If the status stays stuck on queued, Aternos is busy and it is worth trying again shortly.',
  },
}
