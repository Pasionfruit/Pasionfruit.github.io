import { gamingSectionPage } from './siteContent/gaming'
import {
  educationEntries,
  experiencesSectionPage,
  professionalExperienceEntries,
} from './siteContent/experiences'
import { navSections } from './siteContent/home'
import { personalSiteEntries, personalSitesSectionPage } from './siteContent/personalSites'
import { adminDashboards, adminDashboardsById } from './siteContent/admin'
import type { PageContent, SectionId } from './siteContent/shared'

export type {
  AdminDashboardId,
  AdminDashboardMeta,
  AdminIconId,
  EducationEntry,
  NavSection,
  PageCard,
  PageContent,
  PersonalSiteEntry,
  ProfessionalExperienceEntry,
  SectionId,
} from './siteContent/shared'

export {
  adminDashboards,
  adminDashboardsById,
  educationEntries,
  navSections,
  personalSiteEntries,
  professionalExperienceEntries,
}

/** Section chrome for the three collapsible blocks on the home page. */
export const sectionPages: Record<SectionId, PageContent> = {
  experiences: experiencesSectionPage,
  'personal-sites': personalSitesSectionPage,
  gaming: gamingSectionPage,
}
