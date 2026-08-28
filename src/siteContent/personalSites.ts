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
    name: 'POV Cooking',
    url: 'https://pov-cooking.vercel.app/',
    logo: '/POV_Cooking.png',
    tagline: 'Personal cookbook, meal plan, and pantry — desktop and phone',
    description: 'A personal recipe cookbook with weekly meal planning and pantry tracking. It features checkable recipes, kitchen timers, meal randomizers, grocery-list exports, pantry expiration alerts, and ingredient-based recipe matching. Recipes can be imported from URLs, while admins manage suggestions and imports. The app uses an Express API with a swappable JSON/MongoDB data layer and encrypted user emails with blind-index lookup.',
    stack: ['JavaScript', 'React', 'React Router', 'Vite', 'Context API', 'CSS', 'SVG', 'Node.js', 'Express', 'MongoDB', 'JWT', 'bcrypt', 'Google OAuth', 'Tesseract.js', 'ZXing', 'PWA', 'Vercel', 'Render'],
    status: 'live',
  },
  {
    name: 'Type to Beat',
    url: 'https://texthero.onrender.com/',
    logo: '/Text-To-Beat.png',
    tagline: 'Rhythm game played with keyboard inputs',
    description: 'A browser rhythm game where you hit notes by typing. Charts are generated automatically from any song you upload via Web Audio onset detection, and a WebSocket lobby lets you race others in real time.',
    stack: ['TypeScript', 'Vite', 'Canvas', 'Web Audio API', 'Node.js', 'WebSocket', 'Postgres', 'Render'],
    status: 'live',
  },
  {
    name: 'LocalRot',
    url: 'https://mahjong-xmhv.onrender.com/',
    logo: '/LocalRot.png',
    tagline: 'Browser game night — party, solo, and daily puzzles',
    description: 'A game-night arcade in the browser with three wings: room-based real-time multiplayer (Mahjong, Bomberman, Tetris, Quoridor and more) behind a 4-letter room code, a solo offline-capable arcade with global leaderboards, and one shared daily puzzle per game per UTC day with streak tracking. All multiplayer rule legality is computed server-side over Socket.IO; solo games run client-authoritative on deterministic seeds and sync through an IndexedDB outbox.',
    stack: ['TypeScript', 'React', 'Vite', 'zustand', 'Canvas', 'SVG', 'Node.js', 'Express', 'Socket.IO', 'Supabase', 'Postgres', 'IndexedDB', 'PWA', 'Render'],
    status: 'live',
  },
  {
    name: 'abepasion.com',
    url: 'https://pasionfruit.github.io',
    tagline: 'This site',
    description:
      'The site you are on. React and TypeScript on GitHub Pages, with a Google Sheets and Apps Script backend, Todoist for tasks, and daily sync jobs for training and health data. There is actually an admin side to this site that is not public, which is where I manage the content and sync jobs, and use a locally hosted AI assistant to manage training, work, and personal projects.',
    stack: ['React', 'TypeScript', 'Vite', 'Apps Script'],
    status: 'live',
  },
]
