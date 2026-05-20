import { aboutMeDetailPages, aboutMeSectionPage } from './siteContent/aboutMe'
import { cookingDetailPages, cookingSectionPage } from './siteContent/cooking'
import {
  actuaryExamEntries,
  educationEntries,
  experiencesDetailPages,
  experiencesSectionPage,
  professionalExperienceEntries,
} from './siteContent/experiences'
import { homeHighlights, navSections } from './siteContent/home'
import { milestoneEntries, trainingDetailPages, trainingSectionPage } from './siteContent/training'
import type { PageContent, SectionId, SubpageContent } from './siteContent/shared'

export type {
  ActuaryExamEntry,
  EducationEntry,
  MilestoneEntry,
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
  milestoneEntries,
  navSections,
  professionalExperienceEntries,
}

export const sectionPages: Record<SectionId, PageContent> = {
  mrpasionfruit: aboutMeSectionPage,
  training: trainingSectionPage,
  experiences: experiencesSectionPage,
  cooking: cookingSectionPage,
}

export const detailPages: Record<string, SubpageContent> = {
  ...aboutMeDetailPages,
  ...trainingDetailPages,
  ...experiencesDetailPages,
  ...cookingDetailPages,
}
