import type { NavSection } from './shared'
import { challengesNavSection } from './challenges'
import { experiencesNavSection } from './experiences'
import { gamingNavSection } from './gaming'
import { personalSitesNavSection } from './personalSites'
import { trainingNavSection } from './training'

export const navSections: NavSection[] = [
  experiencesNavSection,
  trainingNavSection,
  personalSitesNavSection,
  gamingNavSection,
  challengesNavSection,
]
