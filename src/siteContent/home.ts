import type { NavSection, PageCard } from './shared'
import { aboutMeNavSection } from './aboutMe'
import { financesNavSection } from './finances'
import { cookingNavSection } from './cooking'
import { experiencesNavSection } from './experiences'
import { trainingNavSection } from './training'
import { gamingNavSection } from './gaming'

export const homeIntro = {
  title: 'Living with Passion',
  paragraphs: [
    "I'm Abe Pasion — a BI developer and data analyst in Florida, currently working on statewide transportation data and studying for actuarial exams on the side. This site is where I keep the things I'd otherwise lose track of: what I cooked, what I lifted, what I studied, and what I learned building any of it.",
    "Most of it started as a spreadsheet. I'd track a training block, or compare grocery prices across four stores, or take notes on an exam topic, and then never look at the file again. Turning each of those into a page forced me to actually write down the reasoning — why a meal is worth repeating, why a metric matters, what a training week is supposed to accomplish. The writing is the point; the charts are just what's left over.",
    "Everything here is first-hand. The recipes are meals I cook on a normal work week, the training numbers come off my own watch, and the price data is pulled from stores I actually shop at. If something on a page is wrong or out of date, it's because I got it wrong — not because it was scraped from somewhere else.",
  ],
}

export const homeHighlights: PageCard[] = [
  {
    title: 'Training, honestly logged',
    body: "Endurance and strength work fit around a full-time job, which means most weeks are compromises. I log what actually happened rather than what the plan said, then use Garmin and RingConn data to figure out which trends are real and which are noise.",
  },
  {
    title: 'Cooking on a real budget',
    body: 'Recipes here have to survive a work night — reasonable cook time, ingredients I can actually find, and leftovers that keep. Alongside them I track grocery prices across Walmart, Target, Publix, and Aldi, because the same cart can swing a surprising amount between stores.',
  },
  {
    title: 'Studying and the work behind it',
    body: 'Notes from actuarial exam prep and from the day job: SQL and Python pipelines, data validation, and the analysis habits that carry over from work into everything else on this site.',
  },
]

export const navSections: NavSection[] = [
  experiencesNavSection,
  trainingNavSection,
  cookingNavSection,
  gamingNavSection,
  aboutMeNavSection,
  financesNavSection,
]
