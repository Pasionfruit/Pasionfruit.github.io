import { gamingDetailPages, gamingSectionPage } from './siteContent/gaming'
import {
  actuaryExamEntries,
  educationEntries,
  experiencesDetailPages,
  experiencesSectionPage,
  professionalExperienceEntries,
} from './siteContent/experiences'
import { homeHighlights, homeIntro, navSections } from './siteContent/home'
import { personalSiteEntries, personalSitesSectionPage } from './siteContent/personalSites'
import { adminDashboards, adminDashboardsById, adminHomeContent } from './siteContent/admin'
import type { PageContent, SectionId, SubpageContent } from './siteContent/shared'

export type {
  ActuaryExamEntry,
  AdminDashboardId,
  AdminDashboardMeta,
  EducationEntry,
  NavSection,
  PageCard,
  PageContent,
  PersonalSiteEntry,
  ProfessionalExperienceEntry,
  SectionId,
  SubpageContent,
} from './siteContent/shared'

export {
  actuaryExamEntries,
  adminDashboards,
  adminDashboardsById,
  adminHomeContent,
  educationEntries,
  homeHighlights,
  homeIntro,
  navSections,
  personalSiteEntries,
  professionalExperienceEntries,
}

export const sectionPages: Record<SectionId, PageContent> = {
  experiences: experiencesSectionPage,
  'personal-sites': personalSitesSectionPage,
  gaming: gamingSectionPage,
}

export const detailPages: Record<string, SubpageContent> = {
  ...experiencesDetailPages,
  ...gamingDetailPages,
}
