import type { NavSection, PageCard } from './shared'
import { aboutMeNavSection } from './aboutMe'
import { cookingNavSection } from './cooking'
import { experiencesNavSection } from './experiences'
import { trainingNavSection } from './training'

export const homeHighlights: PageCard[] = [
  {
    title: 'Phone-first layout',
    body: 'The navigation opens as a stacked drawer, so the four core areas and their subpages are easy to reach with one thumb.',
  },
  {
    title: 'Editable content path',
    body: 'Each section is fed from a data layer instead of being hardcoded into the component tree, which makes a future CMS easier.',
  },
  {
    title: 'Login placeholder',
    body: 'The home page links to a login screen now, but authentication itself is still a later phase.',
  },
]

export const navSections: NavSection[] = [
  experiencesNavSection,
  trainingNavSection,
  cookingNavSection,
  aboutMeNavSection,
]
