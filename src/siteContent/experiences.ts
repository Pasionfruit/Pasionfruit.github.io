import type {
  EducationEntry,
  NavSection,
  PageContent,
  ProfessionalExperienceEntry,
} from './shared'

export const experiencesNavSection: NavSection = {
  id: 'experiences',
  title: 'Experiences',
  path: '/#experiences',
  summary: 'Professional experiences, education, and the practical things I\'ve learned along the way',
  accent: '#1fcecb',
  children: [],
}

export const experiencesSectionPage: PageContent = {
  eyebrow: 'Work and study',
  title: 'Experiences',
  summary:
    '- Six years across BI development, data analysis, and cybersecurity.\n- Most of the work has the same shape: take messy operational data, make it trustworthy, and turn it into something a decision can rest on.\n- I like using code, math, and statistics to solve hard problems, and sharing what I learn along the way.',
  accent: '#1fcecb',
  cards: [
    {
      title: 'Education',
      body: 'Degree, institution, and the coursework most relevant to the analytical work I do now.',
    },
    {
      title: 'Technical Skills',
      body: `• Actuarial & Analytics\n  -   - Excel/Google Sheets (pivot tables, VLOOKUP, scenario modeling), SQL (PostgreSQL, MySQL), Python (pandas, numpy, scipy, statsmodels)\n• Data Engineering & Cloud\n    -   - ETL/ELT pipelines, data validation, BI data modeling, PostgreSQL, Delta Lake\n• Programming & Tools\n    -   - Python, SQL, TypeScript, C++, JavaScript, Jupyter, Git, Selenium, Playwright, Pytest, Gemini Notebook LM, Github Copilot\n`,
    },
    {
      title: 'Professional Experience',
      body: 'Roles across BI development, data analysis, cybersecurity, and a few jobs before that. Use the toggle to narrow it to technical work or show everything.',
    },
  ],
  // Folded into the summary bullets above.
  callout: '',
}

export const educationEntries: EducationEntry[] = [
  {
    degree: 'B.S. Computer Science',
    institution: 'Florida State University, Tallahassee, FL',
    date: 'Dec 2024',
    gpa: '3.46 / 4.0',
    coursework: 'Introduction to Probability, Business Statistics, Calculus I–III, Discrete Mathematics I & II, Data Structures, Operating Systems',
  },
]

export const professionalExperienceEntries: ProfessionalExperienceEntry[] = [
  {
    position: 'Data Analyst',
    company: 'State Farm',
    date: 'September 2026 - Present',
    category: 'technical',
    note: '',
  },
  {
    position: 'BI Developer / Data Analyst II',
    company: 'HNTB / FDOT',
    date: 'April 2025 - September 2026',
    category: 'technical',
    note: '  - Built SQL, Python, and VBA pipelines that reconcile traffic and pricing data across source systems and reports, cutting manual validation by ~60%\n  - Validated statewide traffic and DMS data across 28 subsystems with reusable checks and dashboards that sped up three statewide releases\n  - Turned FDOT requirements into data checks and curated datasets for 20+ enterprise sources, using LLM-assisted doc analysis to speed delivery 40%+',
  },
  {
    position: 'Software Developer Intern',
    company: 'Shop Online New York',
    date: 'February 2025 - April 2025',
    category: 'technical',
    note: '  - Built a cross-platform Flutter app for four role-based user types, with access controls that cut authorization defects\n  - Integrated Firebase for real-time data, auth, and storage, and ran the full Jira ticket lifecycle from requirement to feature',
  },
  {
    position: 'Cybersecurity Analyst Intern',
    company: 'Florida State University',
    date: 'September 2023 - May 2024',
    category: 'technical',
    note: '  - Standardized security controls for FSU Health Research teams against NIST 800-53 and FedRAMP Moderate, easing audit prep\n  - Ran risk assessments and control-gap analysis across Azure and Alert Logic, covering identity, logging, and data protection',
  },
  {
    position: 'Information Technology Support Assistant',
    company: 'Escambia County School District',
    date: 'August 2022 - May 2021',
    category: 'technical',
    note: '  - Standardized security controls for FSU Health Research teams against NIST 800-53 and FedRAMP Moderate, easing audit prep\n  - Ran risk assessments and control-gap analysis across Azure and Alert Logic, covering identity, logging, and data protection',
  },
  {
    position: 'Mathematics Tutor',
    company: 'Mathnasium',
    date: 'September 2022 - August 2023',
    category: 'other',
    note: '  - Taught math from arithmetic through Calculus II, raising students by about one letter grade on average\n  - Prepped students for college admission exams, with 20%+ average score gains',
  },
  {
    position: 'Lifeguard',
    company: 'Splash City Adventures and City of Tallahassee',
    date: '3 seasons, May 2021 - December 2022',
    category: 'other',
    note: '  - Performed rescues, administered first aid, and enforced pool safety rules\n  - Stayed calm in emergencies and kept pools clean and safe, including testing and balancing chemicals',
  },
]
