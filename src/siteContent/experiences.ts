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
      body: `• Actuarial & Analytics\n  -   - Excel/Google Sheets (pivot tables, VLOOKUP, scenario modeling), SQL (PostgreSQL, MySQL), Python (pandas, numpy, scipy, statsmodels)\n• Data Engineering & Cloud\n    -   - ETL/ELT pipelines, data validation, BI data modeling, PostgreSQL, Delta Lake\n• Programming & Tools\n    -   - Python, SQL, TypeScript, C++, JavaScript, Jupyter, Git, Selenium, Playwright, Pytest, Gemini Notebook LM, Github Copilot\n`,
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
        body: 'Google Drive links to all my notes and previous studying trackers (updated weekly/as notebook fills up)',
      },
    ],
    note: '',
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
    degree: 'B.S. Computer Science',
    institution: 'Florida State University, Tallahassee, FL',
    date: 'Dec 2024',
    gpa: '3.46 / 4.0',
    coursework: 'Introduction to Probability, Business Statistics, Calculus I–III, Discrete Mathematics I & II, Data Structures, Operating Systems',
  },
]

export const professionalExperienceEntries: ProfessionalExperienceEntry[] = [
  {
    position: 'BI Developer / Data Analyst II',
    company: 'HNTB / FDOT',
    date: 'April 2025 - Present',
    category: 'technical',
    note: '  - Developed SQL, Python, and VBA–based analytics and automation pipelines to reconcile traffic and pricing data between source systems and reporting layers, reducing manual validation effort by ~60% and improving data reliability for statewide decision-making \n  - Analyzed statewide traffic and Dynamic Message Sign (DMS) datasets to validate operational accuracy across 28 transportation subsystems, supporting FDOT’s traffic management and pricing strategies for express lanes \n  - Designed reusable validation frameworks and dashboards to surface SLA risks, trend anomalies, and release readiness metrics, accelerating test and release cycles across three statewide deployments (2 SunGuide hotfixes, 1 SELS release), \n  - Partnered directly with FDOT stakeholders, developers, and BI teams to translate business and operational requirements into measurable data checks, curated datasets, and reporting outputs used by internal and external consumers, \n  - Supported ingestion and transformation of 20+ enterprise datasets, ensuring accuracy and consistency across reporting workflows used for operational monitoring and client-facing dashboards\n  - Leveraged LLM-assisted documentation analysis (self-hosted Ollama, Gemini Notebook LM) to extract requirements and generate structured validation artifacts, improving analysis throughput and accelerating development timelines by 40%+\n',
  },
  {
    position: 'Software Developer Intern',
    company: 'Shop Online New York',
    date: 'February 2025 - April 2025',
    category: 'technical',
    note: '  - Built a cross-platform Flutter application supporting four role-based user types, implementing access controls and structured data flows to reduce authorization defects and improve system reliability\n  - Integrated Firebase for real-time data ingestion, authentication, and storage; managed the full Jira ticket lifecycle, translating functional requirements into deliverable features',
  },
  {
    position: 'Cybersecurity Analyst Intern',
    company: 'Florida State University',
    date: 'September 2023 - May 2024',
    category: 'technical',
    note: '  - Standardized security and compliance controls for FSU Health Research teams, aligning workflows to NIST 800-53 and FedRAMP Moderate, reducing audit preparation effort and compliance ambiguity\n  - Conducted risk assessments and control gap analysis across Azure and Alert Logic integrations, evaluating identity management, logging, and data protection controls for health data systems',
  },
  {
    position: 'Information Technology Support Assistant',
    company: 'Escambia County School District',
    date: 'August 2022 - May 2021',
    category: 'technical',
    note: '  - Standardized security and compliance controls for FSU Health Research teams, aligning workflows to NIST 800-53 and FedRAMP Moderate, reducing audit preparation effort and compliance ambiguity\n  - Conducted risk assessments and control gap analysis across Azure and Alert Logic integrations, evaluating identity management, logging, and data protection controls for health data systems',
  },
  {
    position: 'Mathematics Tutor',
    company: 'Mathnasium',
    date: 'September 2022 - August 2023',
    category: 'other',
    note: '  - Delivered individualized mathematics instruction from arithmetic through calculus II, improving student performance by an average of one letter grade through structured problem-solving methods\n  - Prepared students for college admission exams, achieving 20%+ average score improvement, demonstrating ability to translate complex quantitative concepts into clear, accessible explanations',
  },
  {
    position: 'Lifeguard',
    company: 'Splash City Adventures and City of Tallahassee',
    date: '3 seasons, May 2021 - December 2022',
    category: 'other',
    note: '  - Skilled in performing rescue operations, administering first aid, and enforcing pool rules and regulations. \n  - Demonstrated ability to remain calm and act quickly in emergency situations. Proficient in maintaining clean and safe pool environments, including regular testing and balancing of pool chemicals.',
  },
]
