import type { NavSection, PageContent, PersonalSiteEntry } from './shared'

export const personalSitesNavSection: NavSection = {
  id: 'personal-sites',
  title: 'Personal Sites',
  path: '/personal-sites',
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
    tagline: 'Recipes, meal planning, and grocery cost tracking',
    description:
      'The cooking work that used to live on this site, rebuilt as its own app: recipes worth repeating, a weekly meal plan that turns into one grocery list, and price tracking across Walmart, Target, Publix, and Aldi.',
    stack: ['Next.js', 'Vercel'],
    status: 'live',
  },
  {
    name: 'TextHero',
    url: 'https://texthero.onrender.com/',
    tagline: 'Text processing in the browser',
    description: 'A small web tool for working through text transformations without leaving the browser.',
    stack: ['Python', 'Render'],
    status: 'live',
  },
  {
    name: 'LocalRot',
    url: 'https://mahjong-xmhv.onrender.com/',
    tagline: 'Mahjong you can play with friends',
    description: 'A browser-playable mahjong build put together so a group can get a game going from a link.',
    stack: ['Python', 'Render'],
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
