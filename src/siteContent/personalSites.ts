import type { NavSection, PageContent, PersonalSiteEntry } from './shared'

export const personalSitesNavSection: NavSection = {
  id: 'personal-sites',
  title: 'Personal Sites',
  path: '/#personal-sites',
  summary: 'Side projects that are deployed and open to try',
  accent: '#2a9d8f',
  children: [],
}

export const personalSitesSectionPage: PageContent = {
  eyebrow: 'Side projects',
  title: 'Personal Sites',
  summary:
    'Projects I built outside of work that are deployed somewhere public. Each one is linked below — they are open to try, no sign-in required.',
  accent: '#2a9d8f',
  cards: [],
  callout:
    'Most of these run on free hosting tiers, so the first request after a quiet period can take a few seconds while the instance wakes up.',
}

/**
 * Ordered newest-interesting first. `url` is the live deployment; the card
 * links straight to it rather than to a write-up.
 */
export const personalSiteEntries: PersonalSiteEntry[] = [
  {
    name: 'Quack Island',
    url: 'https://quackisland.onrender.com/',
    tagline: 'Multiplayer 3D browser game',
    description:
      'Explore a procedural 3D island with friends through code-based lobbies, with live weather, day-night cycles, and tides, plus a volcano board-game race and party minigames.',
    stack: ['TypeScript', 'React', 'Three.js', 'Node.js', 'WebSocket'],
    status: 'in-progress',
  },
  {
    name: 'POV Cooking',
    url: 'https://pov-cooking.vercel.app/',
    logo: '/POV_Cooking.png',
    tagline: 'Personal cookbook, meal plan, and pantry — desktop and phone',
    description:
      'A recipe cookbook with weekly meal plans, pantry tracking, and grocery exports. Import recipes from any URL, then cook with checkable steps and kitchen timers.',
    stack: ['React', 'Node.js', 'Express', 'MongoDB', 'PWA'],
    status: 'live',
  },
  {
    name: 'Type to Beat',
    url: 'https://texthero.onrender.com/',
    logo: '/Text-To-Beat.png',
    tagline: 'Rhythm game played with keyboard inputs',
    description:
      'A rhythm game you play by typing. Upload any song and it builds the chart automatically, then race friends live.',
    stack: ['TypeScript', 'Canvas', 'Web Audio API', 'WebSocket', 'Postgres'],
    status: 'live',
  },
  {
    name: 'LocalRot',
    url: 'https://mahjong-xmhv.onrender.com/',
    logo: '/LocalRot.png',
    tagline: 'Browser game night — party, solo, and daily puzzles',
    description:
      'A browser game-night arcade: real-time multiplayer rooms (Mahjong, Bomberman, Tetris, and more), a solo arcade with leaderboards, and a daily puzzle with streaks.',
    stack: ['TypeScript', 'React', 'Socket.IO', 'Supabase', 'PWA'],
    status: 'live',
  },
  {
    name: 'abepasion.com',
    url: 'https://pasionfruit.github.io',
    tagline: 'This site',
    description:
      'This site: React and TypeScript on GitHub Pages, backed by Google Sheets and Apps Script, with daily training and health syncs and a private admin side.',
    stack: ['React', 'TypeScript', 'Vite', 'Apps Script'],
    status: 'live',
  },
]
