import type { NavSection, PageCard } from './shared'
import { experiencesNavSection } from './experiences'
import { gamingNavSection } from './gaming'
import { personalSitesNavSection } from './personalSites'

export const homeIntro = {
  title: 'Living with Passion',
  paragraphs: [
    "I'm Abe Pasion — a BI developer and data analyst in Florida, currently working on statewide transportation data and studying for actuarial exams on the side. This site is the front door to that work: where I've worked, what I've built, and what I run for friends.",
    "Most of what I build starts as a spreadsheet I got tired of maintaining by hand. A training block, a grocery price comparison across four stores, an exam study plan — each one eventually turned into something with a URL. The projects under Personal Sites are the ones that made it far enough to deploy.",
    'Everything here is first-hand. The experience section is my actual resume, the projects are ones I wrote and host myself, and the Minecraft server is one my friends actually play on.',
  ],
}

export const homeHighlights: PageCard[] = [
  {
    title: 'Data work, end to end',
    body: 'SQL and Python pipelines, data validation, and BI modeling on statewide transportation data by day — and the same habits applied to everything I build on my own time.',
  },
  {
    title: 'Projects that ship',
    body: 'A handful of side projects that are deployed and open to try rather than sitting half-finished in a repo. Recipes and grocery costs, a text tool, a mahjong game, and this site.',
  },
  {
    title: 'Studying, still',
    body: 'Actuarial exam prep alongside a full-time job, which mostly comes down to protecting a small amount of time each week and using it well.',
  },
]

export const navSections: NavSection[] = [
  experiencesNavSection,
  personalSitesNavSection,
  gamingNavSection,
]
