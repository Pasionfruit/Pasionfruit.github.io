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
      body: `• Programming & Tools\n    - Python, SQL, TypeScript, C++, JavaScript, Jupyter, Git, Selenium, Playwright, Pytest\n• Data Engineering & Cloud\n    - Excel, ETL/ELT pipelines, data validation, BI data modeling, PostgreSQL, Delta Lake\n• Actuarial & Analytics\n    - Excel/Google Sheets (pivot tables, VLOOKUP, scenario modeling), SQL (PostgreSQL, MySQL), Python (pandas, numpy, scipy, statsmodels)`,
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
    degree: 'B.S. in Computer Science',
    institution: 'Florida State University',
    date: 'December 2024',
  },
]

export const professionalExperienceEntries: ProfessionalExperienceEntry[] = [
  {
    position: 'BI Developer / Data Analyst II',
    company: 'HNTB / FDOT',
    date: 'April 2025 - Present',
    category: 'technical',
    note: '- Designed and executed data validation and reconciliation frameworks across Azure ingestion pipelines (ADF → ADLS → Databricks), surfacing 1,000+ data inconsistencies across Bronze and Silver layers — contributing to a ~40% reduction in downstream reporting defects post-release\n - Built Python and SQL automation scripts for daily data reconciliation between source systems and reporting layers, eliminating ~60% of manual validation effort and establishing a single source of truth \n - Leveraged Azure OpenAI (Foundry models) and self-hosted Ollama LLMs to generate templated test cases and Jira tickets, accelerating test development velocity by 40%+\n - Supported ingestion of 20+ enterprise datasets into Azure Data Lake Storage and validated Databricks Spark transformation workflows to ensure SLA-driven reporting accuracy\n - Partnered with BI teams to publish curated data marts powering operational and client-facing dashboards for internal and external stakeholders\n - Spearheaded automated regression testing using Selenium and Playwright, reducing manual testing time by 10–20% and expanding test coverage across statewide software\n',
  },
  {
    position: 'Software Developer Intern',
    company: 'Shop Online New York',
    date: 'February 2025 - April 2025',
    category: 'technical',
    note: '- Built a cross-platform Flutter application supporting 4 distinct user roles (user, admin, seller, buyer) with role-based access controls, reducing authorization defects and improving navigation clarity\n - Integrated Firebase for real-time data management, authentication, and cloud storage; managed end-to-end Jira ticket lifecycle for this workstream',
  },
  {
    position: 'Cybersecurity Analyst Intern',
    company: 'Florida State University',
    date: 'September 2023 - May 2024',
    category: 'technical',
    note: '- Standardized security procedures and compliance controls for FSU Health Research teams, aligning operations to NIST 800-53 and FedRAMP Moderate baselines — reducing audit preparation effort and compliance ambiguity\n - Conducted security assessments and risk analysis of Azure and Alert Logic integrations for the Health Data Science Initiative, identifying control gaps across identity, logging, and data protection layers',
  },
  {
    position: 'Information Technology Support Assistant',
    company: 'Escambia County School District',
    date: 'August 2022 - May 2021',
    category: 'technical',
    note: '- Provided technical support, installed, tested, and troubleshot approximately 200 various computer systems\n- Resolved hardware and software issues for various devices including printers, projectors, and computers, enhancing the institution\'s technological efficiency',
  },
  {
    position: 'Mathematics Tutor',
    company: 'Mathnasium',
    date: 'September 2022 - August 2023',
    category: 'other',
    note: '- Delivered individualized math instruction across arithmetic through pre-calculus, improving students grades by an average of one letter grade through tailored problem-solving strategies\n - Prepared students for college admission standardized tests, achieving 20%+ average improvement on math sections — demonstrating ability to translate quantitative concepts into accessible, structured explanations',
  },
  {
    position: 'Lifeguard',
    company: 'Splash City Adventures and City of Tallahassee',
    date: '3 seasons, May 2021 - December 2022',
    category: 'other',
    note: '- Experienced and certified lifeguard with two summer seasons of experience ensuring the safety of swimmers at public pools. \n- Skilled in performing rescue operations, administering first aid, and enforcing pool rules and regulations. \n- Demonstrated ability to remain calm and in quickly in emergency situations. Proficient in maintaining clean and safe pool environments, including regular testing and balancing of pool chemicals. ',
  },
]
