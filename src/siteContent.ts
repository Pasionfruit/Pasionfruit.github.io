import { aboutMeDetailPages, aboutMeSectionPage } from './siteContent/aboutMe'
import { cookingDetailPages, cookingSectionPage } from './siteContent/cooking'
import { financesSectionPage } from './siteContent/finances'
import {
  actuaryExamEntries,
  educationEntries,
  experiencesDetailPages,
  experiencesSectionPage,
  professionalExperienceEntries,
} from './siteContent/experiences'
import { homeHighlights, navSections } from './siteContent/home'
import { trainingDetailPages, trainingSectionPage } from './siteContent/training'
import type { PageContent, SectionId, SubpageContent } from './siteContent/shared'

export type {
  ActuaryExamEntry,
  EducationEntry,
  NavSection,
  PageCard,
  PageContent,
  ProfessionalExperienceEntry,
  SectionId,
  SubpageContent,
} from './siteContent/shared'

export {
  actuaryExamEntries,
  educationEntries,
  homeHighlights,
  navSections,
  professionalExperienceEntries,
}

export const sectionPages: Record<SectionId, PageContent> = {
  mrpasionfruit: aboutMeSectionPage,
  training: trainingSectionPage,
  experiences: experiencesSectionPage,
  cooking: cookingSectionPage,
  finances: financesSectionPage,
}

export const detailPages: Record<string, SubpageContent> = {
  ...aboutMeDetailPages,
  ...trainingDetailPages,
  ...experiencesDetailPages,
  ...cookingDetailPages,
}
