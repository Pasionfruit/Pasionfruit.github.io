import type { NavSection, PageContent, SubpageContent } from './shared'

export const aboutMeNavSection: NavSection = {
  id: 'mrpasionfruit',
  title: 'About Me',
  path: '/mrpasionfruit',
  summary: 'Personal identity, interests, and the Oreo gang corner',
  accent: '#00CCCC',
  children: [],
}

export const aboutMeSectionPage: PageContent = {
  eyebrow: 'About me',
  title: 'Abe Pasion',
  summary:
    'MBTI: ISFJ || Enneagram: Type 5 || DISC: C / D || D.O.V.E: Owl-Eagle || Cat dad\n• Spotify: https://open.spotify.com/user/de0y0osvptr9ac25r3pxaq9j0?si=d61248cfae5742a8',
  accent: '#ff7a59',
  cards: [
    {
      title: 'Meet the Oreo Gang',
      body: '(Mr) Midnight, (Madam) Pirouette, (Stinky) Inky',
    },
    {
      title: 'Question of the Day',
      body: "Who are you? Add ability for a weekly vote, must sign in to vote, once voted, changes reflected \n\nCurrent media: Sophie's World - Jostein Gaarder",
    },
    {
      title: 'Bucket List',
      body: '• Building personal NAS\n• Developing turn-based multiplayer video game \n• Starting a garden\n• Building a terrarium\n• Acquiring private pilots license\n• Hitting Immortal in Valorant\n• See aurora borealis\n• Hike the Alps\n• Snowboard in Japan\n• Visit New Zealand\n• Acquire scuba license\n• Visit Great Barrier Reef\n',
    },
    {
      title: 'Places visited',
      body: 'Color of the world, with countries/states visited highlighted.',
    },
    {
      title: 'Backpack',
      body: 'Traveling inventory grouped by storage and type.',
    },
  ],
  callout:
    "Hi, I'm Abe, you could probably tell I have a lot of interests. I come from a rather diverse background, but throughly enjoy adapting, learning, and understanding conceptual matters. I like to go on adventures, mainly a doer on trips, most fun with friends/family. As long as you're openminded and chill, we'll get along just fine :)",
}

export const aboutMeDetailPages: Record<string, SubpageContent> = {
  '/mrpasionfruit/oreo-gang': {
    eyebrow: 'Inside joke archive',
    title: 'Oreo Gang',
    summary:
      'A place for group memories, story snippets, and anything else that deserves its own playful corner.',
    accent: '#ff7a59',
    cards: [
      {
        title: 'Community',
        body: 'Keep the tone personal and light so the page feels like a shared memory board.',
      },
      {
        title: 'Posts',
        body: 'This can later turn into a collection of short entries, photos, or running jokes.',
      },
      {
        title: 'Feel',
        body: 'Make it easy to skim on a phone while still leaving room for longer memories.',
      },
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
      {
        title: 'Building',
        body: 'Tools, side projects, and experiments I want to keep iterating on.',
      },
      {
        title: 'Watching',
        body: 'Shows, videos, and creators that sparked a new idea or habit.',
      },
    ],
    note: 'This page can later feed into recommendations or a content feed.',
  },
}
