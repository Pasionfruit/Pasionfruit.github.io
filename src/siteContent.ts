export type SectionId = 'mrpasionfruit' | 'training' | 'experiences' | 'cooking'

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
}

export type MilestoneEntry = {
  name: string
  value: string
  category: 'lifting' | 'running' | 'ironman' | 'etc'
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

export const milestoneEntries: MilestoneEntry[] = [
  // Lifting
  { name: 'Total Weight', value: '770 lbs', category: 'lifting' },
  { name: 'Bench', value: '230 lbs', category: 'lifting' },
  { name: 'Squat', value: '245 lbs', category: 'lifting' },
  { name: 'Deadlift', value: '295 lbs', category: 'lifting' },
  // Running
  { name: '5K', value: '35:50', category: 'running' },
  { name: '10K', value: 'TBD', category: 'running' },
  { name: 'Half Marathon', value: 'TBD', category: 'running' },
  { name: 'Full Marathon', value: 'TBD', category: 'running' },
  // Ironman
  { name: 'Sprint', value: 'TBD', category: 'ironman' },
  { name: 'Olympic', value: 'TBD', category: 'ironman' },
  { name: '70.3', value: 'TBD', category: 'ironman' },
  { name: 'Full Ironman', value: 'TBD', category: 'ironman' },
  // Etc
  { name: 'Hyrox', value: 'TBD', category: 'etc' },
  { name: 'Pole Vault', value: '14\'6"', category: 'etc' },
]

export const navSections: NavSection[] = [
  {
    id: 'experiences',
    title: 'Experiences',
    path: '/experiences',
    summary: 'Professional experiences, education, and the practical things I’ve learned along the way',
    accent: '#000080',
    children: [
      {
        label: 'Studying',
        path: '/experiences/studying',
        summary: 'Personal study notes, resources, pomodoro timer',
      },
    ],
  },
  {
    id: 'training',
    title: 'Training',
    path: '/training',
    summary: 'Records, data, and learning resources to understand and track progress ',
    accent: '#FC5200',
    children: [
      {
        label: 'Records',
        path: '/training/records',
        summary: 'Overall PRs of my training sessions (be nice plz)',
      },
      {
        label: 'Training Data Analysis',
        path: '/training/data',
        summary: 'How I analyze personal charts and metrics',
      },
    //   {
    //     label: 'Learn',
    //     path: '/training/learn',
    //     summary: 'Coaches are cool, but I want to understand the why behind the work, not just the what.',
    //   },
    ],
  },
  {
    id: 'cooking',
    title: 'Cooking',
    path: '/cooking',
    summary: 'Favorite recipes, meal planning, culinary lessons, and budget-friendly finds',
    accent: '#FFCE1B',
    children: [
      {
        label: 'Recipes',
        path: '/cooking/recipes',
        summary: 'The meals I want to keep, repeat, and improve.',
      },
      {
        label: 'Plan',
        path: '/cooking/plan',
        summary: 'A weekly cooking map for shopping and prep.',
      },
      {
        label: 'Learn',
        path: '/cooking/learn',
        summary: 'Techniques, ingredient notes, and experiments.',
      },
      {
        label: 'Deals',
        path: '/cooking/deals',
        summary: 'Price tracking, grocery finds, and budget wins.',
      },
    ],
  },
  {
    id: 'mrpasionfruit',
    title: 'About Me',
    path: '/mrpasionfruit',
    summary: 'Personal identity, interests, and the Oreo gang corner',
    accent: '#00CCCC',
    children: [
    //   {
    //     label: 'Oreo Gang',
    //     path: '/mrpasionfruit/oreo-gang',
    //     summary: 'A playful home for the crew, lore, and memories.',
    //   },
    //   {
    //     label: 'Interests',
    //     path: '/mrpasionfruit/interests',
    //     summary: 'The things I’m reading, building, and chasing next.',
    //   },
    ],
  },
]

export const homeHighlights: PageCard[] = [
  {
    title: 'Phone-first layout',
    body: 'The navigation opens as a stacked drawer, so the four core areas and their subpages are easy to reach with one thumb.',
  },
  {
    title: 'Editable content path',
    body: 'Each section is fed from a data layer instead of being hardcoded into the component tree, which makes a future CMS easier.',
  },
  {
    title: 'Login placeholder',
    body: 'The home page links to a login screen now, but authentication itself is still a later phase.',
  },
]

export const sectionPages: Record<SectionId, PageContent> = {
  mrpasionfruit: {
    eyebrow: 'About me',
    title: 'Abe Pasion',
    summary: 'MBTI: ISFJ || Enneagram: Type 5 || DISC: C / D || D.O.V.E: Owl-Eagle || Cat dad\n• Spotify: https://open.spotify.com/user/de0y0osvptr9ac25r3pxaq9j0?si=d61248cfae5742a8',
    accent: '#ff7a59',
    cards: [
      {
        title: 'Meet the Oreo Gang',
        body: '(Mr) Midnight, (Madam) Pirouette, (Stinky) Inky',
      },
      {
        title: 'Personal interests/questions',
        body: 'Who are you? Add ability for a weekly vote, must sign in to vote, once voted, changes reflected \n\nCurrent media: Sophie\'s World - Jostein Gaarder',
      },
      {
        title: 'Bucket List',
        body: '• Building personal NAS\n• Developing turn-based multiplayer video game \n• Starting a garden\n• Building a terrarium\n• Acquiring private pilots license\n• Hitting Immortal in Valorant\n• See aurora borealis\n• Hike the Alps\n• Snowboard in Japan\n• Visit New Zealand\n• Acquire scuba license\n• Visit Great Barrier Reef\n',
      },
      {
        title: 'Places visited',
        body: 'Color of the world, with countries/states visited highlighted.',
      },
    ],
    callout: 'Hi, I\'m Abe, you could probably tell I have a lot of interests. I come from a rather diverse background, but throughly enjoy adapting, learning, and understanding conceptual matters. I like to go on adventures, mainly a doer on trips, most fun with friends/family. As long as you\'re openminded and chill, we\'ll get along just fine :)',
  },
  training: {
    eyebrow: 'Progress tracking',
    title: 'Training',
    summary: 'Stats of the slow times and weak lifts\n• Strava: https://www.strava.com/athletes/116157184\n• Instagram: @mrpasionfruit',
    accent: '#2c9c8f',
    cards: [
    {
        title: 'Next Event Countdown',
        body: '',
      },
      {
        title: 'Workout(s) of the Day',
        body: 'pull data and link to sheet with training plan | Crossed out, completed?',
      },
    ],
    callout: '',
  },
  experiences: {
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
    callout: 'I like to use technical tools, mathematics, and statistical reasoning to understand data, improve systems, and solve complex problems. I enjoy mastering new skills, collaborating with like-minded individuals, and sharing what I learned along the way.',
  },
  cooking: {
    eyebrow: 'Kitchen hub',
    title: 'Cooking',
    summary: '',
    accent: '#e0a800',
    cards: [
      {
        title: 'Meal Plan for the Day',
        body: 'Pull Breakfast, Lunch, Dinner from the weekly plan page, link to the plan page here',
      },
    ],
    callout: '',
  },
}

export const detailPages: Record<string, SubpageContent> = {
  '/mrpasionfruit/oreo-gang': {
    eyebrow: 'Inside joke archive',
    title: 'Oreo Gang',
    summary: 'A place for group memories, story snippets, and anything else that deserves its own playful corner.',
    accent: '#ff7a59',
    cards: [
      { title: 'Community', body: 'Keep the tone personal and light so the page feels like a shared memory board.' },
      { title: 'Posts', body: 'This can later turn into a collection of short entries, photos, or running jokes.' },
      { title: 'Feel', body: 'Make it easy to skim on a phone while still leaving room for longer memories.' },
    ],
    note: 'Use this as the nested personality page under the main about hub.',
  },
  '/mrpasionfruit/interests': {
    eyebrow: 'What I like',
    title: 'Interests',
    summary: 'A shortlist of the subjects, media, and ideas I keep coming back to.',
    accent: '#ff7a59',
    cards: [
      { title: 'Reading', body: 'Books, articles, and notes that shaped how I think this month.' },
      { title: 'Building', body: 'Tools, side projects, and experiments I want to keep iterating on.' },
      { title: 'Watching', body: 'Shows, videos, and creators that sparked a new idea or habit.' },
    ],
    note: 'This page can later feed into recommendations or a content feed.',
  },
  '/training/records': {
    eyebrow: 'Session log',
    title: 'Training Records',
    summary: 'Day 1 or 1 Day',
    accent: '#2c9c8f',
    cards: [
      { title: 'Consistency', body: 'Github chart of training over time' },
      { title: 'Milestones', body: 'Track the lifts or benchmarks that matter most over time.' },
      { title: 'Week Plans', body: 'Chart of Mon - Sun Morning and Evening sessions, completed?' },
      { title: 'Previous Events', body: 'Scrolling filterable list of previous Events' },
    ],
    note: '',
  },
  '/training/data': {
    eyebrow: 'Numbers and trends',
    title: 'Training Data Analysis',
    summary: 'Charts and metrics that make the overall trend easy to understand at a glance.',
    accent: '#2c9c8f',
    cards: [
      { title: 'Health Data Terms', body: 'Filterable list of health data terms and their definitions' },
      { title: 'Tools', body: 'Tools on calculating and visualizing training data' },
      { title: 'Equipment', body: 'Links to training equipment and gear' },
      { title: 'Personal Notes', body: 'Ancedotal observations and reflections on training' },
      { title: 'Learning', body: 'Gemini Notebook with resources and top recommended videos' },
    ],
    note: 'Keep this page readable first and analytical second.',
  },
//   '/training/learn': {
//     eyebrow: 'Technique notes',
//     title: 'Training Learn',
//     summary: 'A notebook for what I am learning, what failed, and what to try differently next.',
//     accent: '#2c9c8f',
//     cards: [
//       { title: 'Cues', body: 'Capture short reminders that help during the next session.' },
//       { title: 'Mistakes', body: 'List the things that went wrong so the next cycle starts sharper.' },
//       { title: 'Experiments', body: 'Record small changes and the result so learning stays practical.' },
//     ],
//     note: 'This page is ideal for small notes that accumulate into a training philosophy.',
//   },
  '/experiences/studying': {
    eyebrow: 'Academic path',
    title: 'Studying',
    summary: 'A home for the exams I am studying, the tools I use, and the habits that keep the work moving.',
    accent: '#7a62ff',
    cards: [
      { title: 'Current Study Plan', body: 'Keep track of the classes or topics that matter this term., link to study plan here' },
      { title: 'Pomodoro Timer', body: "Let's study!" },
      { title: 'Study Materials', body: 'Google Drive links to all my notes and previous studying trackers' },
    ],
    note: 'Use this as the nested page for the experiences section.',
  },
  '/cooking/recipes': {
    eyebrow: 'Repeatable meals',
    title: 'Recipes',
    summary: 'A collection of meals I want to keep around because they are good, practical, or both',
    accent: '#e0a800',
    cards: [
      { title: 'Favorites', body: 'If account exists, favorite recipes will be saved here.' },
      { title: 'Recipes', body: 'Filterable total of all recipes: schema: calories, my video link, recipe website link, dish name, tools, needed, cook time, ingredients, instructions w dynamic incredients, follower rating, storage/fridge life' },
      { title: 'Randomizer', body: 'Choose a meal for me' },
    ],
    note: '- Additional Features: Serving scaler, Metric / Empirical for amount and heat, Mark items have and steps completed',
  },
  '/cooking/plan': {
    eyebrow: 'Weekly prep',
    title: 'Meal Plan',
    summary: 'A simple plan for what to cook, what to buy, and when to prep it.',
    accent: '#e0a800',
    cards: [
      { title: 'Receipt', body: 'Cost and nutrition for the week' },
      { title: 'Grocery list', body: 'Admin' },
      { title: 'Meal Plan for the Week', body: '' },
    ],
    note: 'This page should help decide what happens this week, not just look pretty.',
  },
  '/cooking/learn': {
    eyebrow: 'Kitchen skills',
    title: 'Cooking Learn',
    summary: 'Technique notes, ingredient discoveries, and the experiments worth trying again.',
    accent: '#e0a800',
    cards: [
      { title: 'Technique Tips', body: 'Techniques to improve cooking skills' },
      { title: 'Flavor Maxing', body: 'How each ingredient actuary changes the dish\'s flavor' },
      { title: 'Important/personal lessons/tips', body: 'This can hold the trial-and-error that makes cooking better.' },
      { title: 'Learn', body: 'Gemini Notebook' },
      { title: 'Equipment', body: 'Tools I have/recommendations' },
    ],
    note: 'Make the page useful for future-you on the next grocery run.',
  },
  '/cooking/deals': {
    eyebrow: 'Value watch',
    title: 'Cooking Deals',
    summary: 'One day if dynamic grocery pricing exist, the grocery stores will be a stock market',
    accent: '#e0a800',
    cards: [
      { title: 'Coupons', body: 'Capture what was on sale and where it was found.' },
      { title: 'Specific store deals', body: 'Keep an eye on the ingredients that matter most to the weekly budget.' },
      { title: 'Fast Food Deals', body: 'Keep track of limited-time offers and discounts at fast food restaurants.' },
    ],
    note: 'test',
  },
}
