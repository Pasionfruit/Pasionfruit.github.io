import type {
  ActuaryExamEntry,
  EducationEntry,
  NavSection,
  PageContent,
  ProfessionalExperienceEntry,
  SubpageContent,
} from './shared'

export const experiencesNavSection: NavSection = {
  id: 'experiences',
  title: 'Experiences',
  path: '/experiences',
  summary: 'Professional experiences, education, and the practical things I\'ve learned along the way',
  accent: '#000080',
  children: [
    {
      label: 'Studying',
      path: '/experiences/studying',
      summary: 'Personal study notes, resources, pomodoro timer',
    },
  ],
}

export const experiencesSectionPage: PageContent = {
  eyebrow: 'Work and study',
  title: 'Experiences',
  summary: '• Florida || pasionabe@gmail.com\n• LinkedIn: abe-pasion\n• GitHub: Pasionfruit',
  accent: '#000080',
  cards: [
    {
      title: 'Actuary Exams',
      body: 'Structured list of actuarial exam milestones and timelines.',
    },
    {
      title: 'Education',
      body: 'Structured list of education details and completion dates.',
    },
    {
      title: 'Technical Skills',
      body: `• Programming & Querying
    - - Python, SQL, JavaScript, TypeScript, C++
• Data & Analytics
    - - Excel, ETL/ELT pipelines, data validation, BI data modeling, PostgreSQL, Delta Lake
• Tools & Platforms
    - - Azure Data Factory, Azure DevOps, Linux (Ubuntu), Jira
• Testing & Automation
    - - Regression testing, Selenium, Playwright, Pytest`,
    },
    {
      title: 'Professional Experience',
      body: 'Use the toggle to view technical-only experience or all experience entries.',
    },
  ],
  callout:
    'I like to use technical tools, mathematics, and statistical reasoning to understand data, improve systems, and solve complex problems. I enjoy mastering new skills, collaborating with like-minded individuals, and sharing what I learned along the way.',
}

export const experiencesDetailPages: Record<string, SubpageContent> = {
  '/experiences/studying': {
    eyebrow: 'Academic path',
    title: 'Studying',
    summary:
      'A home for the exams I am studying, the tools I use, and the habits that keep the work moving.',
    accent: '#7a62ff',
    cards: [
      {
        title: 'Current Study Plan',
        body: 'Keep track of the classes or topics that matter this term., link to study plan here',
      },
      { title: 'Pomodoro Timer', body: "Let's study!" },
      {
        title: 'Study Materials',
        body: 'Google Drive links to all my notes and previous studying trackers',
      },
    ],
    note: 'Use this as the nested page for the experiences section.',
  },
}

export const actuaryExamEntries: ActuaryExamEntry[] = [
  {
    exam: 'Exam P',
    topic: 'Probability',
    status: 'Sitting: July 2026',
  },
  {
    exam: 'Exam FM',
    topic: 'Financial Mathematics',
    status: 'Planned: October 2026',
  },
  {
    exam: 'Exam SRM',
    topic: 'Statistics for Risk Modeling',
    status: 'Planned: Jan 2027',
  },
]

export const educationEntries: EducationEntry[] = [
  {
    degree: 'B.S. in Computer Science',
    institution: 'Florida State University',
    date: 'December 2024',
  },
]

export const professionalExperienceEntries: ProfessionalExperienceEntry[] = [
  {
    position: 'BI Developer II',
    company: 'HNTB / FDOT',
    date: 'April 2025 - Present',
    category: 'technical',
    note: 'TBD',
  },
  {
    position: 'Software Developer Intern',
    company: 'Shop Online New York',
    date: 'February 2025 - April 2025',
    category: 'technical',
    note: 'TBD',
  },
  {
    position: 'Cybersecurity Analyst Intern',
    company: 'Florida State University',
    date: 'September 2023 - May 2024',
    category: 'technical',
    note: 'TBD',
  },
  {
    position: 'Information Technology Support Assistant',
    company: 'Escambia County School District',
    date: 'August 2022 - May 2021',
    category: 'technical',
    note: 'TBD',
  },
  {
    position: 'Mathematics Tutor',
    company: 'Mathnasium',
    date: 'September 2022 - August 2023',
    category: 'other',
    note: 'TBD',
  },
  {
    position: 'Lifeguard',
    company: 'Splash City Adventures and City of Tallahassee',
    date: '3 seasons, May 2021 - December 2022',
    category: 'other',
    note: 'TBD',
  },
]
