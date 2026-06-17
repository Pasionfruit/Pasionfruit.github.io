export type SectionId = 'mrpasionfruit' | 'training' | 'experiences' | 'cooking' | 'finances' | 'gaming'

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

export type SubpageContent = {
  eyebrow: string
  title: string
  summary: string
  accent: string
  cards: PageCard[]
  note: string
}

export type NavSection = {
  id: SectionId
  title: string
  path: string
  summary: string
  accent: string
  children: { label: string; path: string; summary: string }[]
}

export type ProfessionalExperienceEntry = {
  position: string
  company: string
  date: string
  category: 'technical' | 'other'
  note?: string
}

export type ActuaryExamEntry = {
  exam: string
  topic: string
  status: string
}

export type EducationEntry = {
  degree: string
  institution: string
  date: string
  gpa?: string
  coursework?: string
}
