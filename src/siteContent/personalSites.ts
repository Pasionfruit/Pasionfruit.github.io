import type { NavSection, PageContent, PersonalSiteEntry } from './shared'

export const personalSitesNavSection: NavSection = {
  id: 'personal-sites',
  title: 'Personal Sites',
  path: '/#personal-sites',
  summary: 'Side projects that are deployed and open to try',
  accent: '#0ea5e9',
  children: [],
}

export const personalSitesSectionPage: PageContent = {
  eyebrow: 'Side projects',
  title: 'Personal Sites',
  summary:
    'Projects I built outside of work that are deployed somewhere public. Each one is linked below — they are open to try, no sign-in required.',
  accent: '#0ea5e9',
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
    tagline: 'Personal cookbook, meal plan, and pantry — desktop and phone',
    description: 'A personal recipe cookbook that also plans the week and tracks what is in the kitchen. Recipes are semi-structured JSON (only a title is required, unknown fields are preserved) with checkable ingredients and steps, a dial kitchen timer, and filtering by meal type, cuisine, time, saved, or never-cooked. A meal plan lays recipes out day by day with two randomizers — a spin wheel and a build-a-meal roller that picks a carb, protein, sauce, and vegetable — and exports as copyable text or a grocery list. The pantry tracks purchase dates and shelf life, warns on items to use soon, and answers "what can I make right now" by matching unexpired items against recipes; items go in by hand, by barcode scan, or by OCR of a receipt photo. Admins import recipes from any URL by reading the page schema.org data behind an SSRF-guarded fetch, review user suggestions, and pin the latest attempt. The API is a single Express instance whose whole data layer is one synchronous write-through cache that swaps JSON files for MongoDB by env var alone, and user emails are stored AES-256-GCM encrypted with an HMAC blind index for lookup.',
    stack: ['JavaScript', 'React', 'React Router', 'Vite', 'Context API', 'CSS', 'SVG', 'Node.js', 'Express', 'MongoDB', 'JWT', 'bcrypt', 'Google OAuth', 'Tesseract.js', 'ZXing', 'PWA', 'Vercel', 'Render'],
    status: 'live',
  },
  {
    name: 'Type to Beat',
    url: 'https://texthero.onrender.com/',
    tagline: 'Rhythm game played with keyboard inputs',
    description: 'A browser rhythm game where you hit notes by typing. Charts are generated automatically from any song you upload via Web Audio onset detection, and a WebSocket lobby lets you race others in real time.',
    stack: ['TypeScript', 'Vite', 'Canvas', 'Web Audio API', 'Node.js', 'WebSocket', 'Postgres', 'Render'],
    status: 'live',
  },
  {
    name: 'LocalRot',
    url: 'https://mahjong.onrender.com/',
    tagline: 'Browser game night — party, solo, and daily puzzles',
    description: 'A game-night arcade in the browser with three wings: room-based real-time multiplayer (Mahjong, Bomberman, Tetris, Quoridor and more) behind a 4-letter room code, a solo offline-capable arcade with global leaderboards, and one shared daily puzzle per game per UTC day with streak tracking. All multiplayer rule legality is computed server-side over Socket.IO; solo games run client-authoritative on deterministic seeds and sync through an IndexedDB outbox.',
    stack: ['TypeScript', 'React', 'Vite', 'zustand', 'Canvas', 'SVG', 'Node.js', 'Express', 'Socket.IO', 'Supabase', 'Postgres', 'IndexedDB', 'PWA', 'Render'],
    status: 'live',
  },
  {
    name: 'mrpasionfruit',
    url: 'https://pasionfruit.github.io',
    tagline: 'This site',
    description:
      'The site you are on. React and TypeScript on GitHub Pages, with a Google Sheets and Apps Script backend, Todoist for tasks, and daily sync jobs for training and health data.',
    stack: ['React', 'TypeScript', 'Vite', 'Apps Script'],
    status: 'live',
  },
]
