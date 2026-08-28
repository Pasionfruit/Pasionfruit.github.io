/** Sections a signed-out visitor can reach. Everything else lives behind /admin. */
export type SectionId = 'experiences' | 'personal-sites' | 'gaming'

/** The private dashboards, available only to the admin Google account. */
export type AdminDashboardId =
  | 'tasks'
  | 'calendar'
  | 'journal'
  | 'finance'
  | 'training'
  | 'work'

export type PageCard = {
  title: string
  body: string
}

export type PageContent = {
  eyebrow: string
  title: string
  summary: string
  accent: string
  cards: PageCard[]
  callout: string
}

export type NavSection = {
  id: SectionId
  title: string
  /** In-page anchor on the home page — the sections no longer have their own routes. */
  path: string
  summary: string
  accent: string
  children: { label: string; path: string; summary: string }[]
}

/** Nav + page chrome for one admin dashboard. Dashboards have no subpages. */
export type AdminDashboardMeta = {
  id: AdminDashboardId
  title: string
  path: string
  /** One-line label used on the /admin tile grid and in the side menu. */
  summary: string
  accent: string
  eyebrow: string
  /** Longer intro shown under the dashboard title. */
  intro: string
  note: string
}

/** A deployed side project linked from the public Personal sites section. */
export type PersonalSiteEntry = {
  name: string
  url: string
  /** Short label for what the site is, shown under the name. */
  tagline: string
  description: string
  stack: string[]
  /** Live sites get a "Try it" call to action; archived ones do not. */
  status: 'live' | 'in-progress' | 'archived'
}

export type ProfessionalExperienceEntry = {
  position: string
  company: string
  date: string
  category: 'technical' | 'other'
  note?: string
}

export type EducationEntry = {
  degree: string
  institution: string
  date: string
  gpa?: string
  coursework?: string
}
