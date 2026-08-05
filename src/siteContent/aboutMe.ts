import type { NavSection, PageContent, SubpageContent } from './shared'

export const aboutMeNavSection: NavSection = {
  id: 'mrpasionfruit',
  title: 'About Me',
  path: '/mrpasionfruit',
  summary: 'Personal identity, interests, and the Oreo gang corner',
  accent: '#ff5c38',
  children: [],
}

export const aboutMeSectionPage: PageContent = {
  eyebrow: 'About me',
  title: 'Abe Pasion',
  summary:
    'MBTI: ISFJ || Enneagram: Type 5 || DISC: C / D || D.O.V.E: Owl-Eagle || Cat dad\n• Spotify: https://open.spotify.com/user/de0y0osvptr9ac25r3pxaq9j0?si=d61248cfae5742a8',
  accent: '#ff5c38',
  cards: [
    {
      title: 'Meet the Oreo Gang',
      body: 'The cats I live with.',
    },
    {
      title: 'Question of the Day',
      body: 'Currently disabled while I work out a way to keep it updated without leaving it open to abuse.',
    },
    {
      title: 'Bucket List',
      body: '• Building personal NAS\n• Developing turn-based multiplayer video game \n• Starting a garden\n• Building a terrarium\n• Acquiring private pilots license\n• Hitting Immortal in Valorant\n• See aurora borealis\n• Hike the Alps\n• Snowboard in Japan\n• Visit New Zealand\n• Acquire scuba license\n• Visit Great Barrier Reef\n',
    },
    {
      title: 'Places visited',
      body: 'A map of the world with the countries and states I have been to highlighted.',
    },
    {
      title: 'Backpack',
      body: 'What I actually pack, grouped by bag and category — refined over enough trips to be worth writing down.',
    },
  ],
  callout:
    "Hi, I'm Abe! You could probably tell I have a lot of interests, and that I come from a rather diverse background. I like torturing myself with training and studying, but when I'm free, I like to go on adventures. I'm a doer on trips and like to travel with friends/family. As long as you're openminded, we'll get along just fine :)",
}

export const aboutMeDetailPages: Record<string, SubpageContent> = {
  '/mrpasionfruit/oreo-gang': {
    eyebrow: 'The cats',
    title: 'Oreo Gang',
    summary:
      'The cats I live with, and the running collection of photos and small stories that come with them. This is the least serious corner of the site and intentionally so — no metrics, no tracking, no analysis.',
    accent: '#ff5c38',
    cards: [
      {
        title: 'The gang',
        body: 'Who they are, how each of them ended up here, and the personality differences that became obvious within about a week.',
      },
      {
        title: 'Daily life',
        body: 'What living with them actually looks like — the routines they enforce, the furniture they have claimed, and the ongoing negotiation over desk space during work hours.',
      },
      {
        title: 'Photos and stories',
        body: 'A growing archive of pictures and the short stories attached to them.',
      },
    ],
    note: 'A memory board more than a page — it grows whenever something is worth remembering.',
  },
  '/mrpasionfruit/interests': {
    eyebrow: 'What I like',
    title: 'Interests',
    summary:
      'The subjects I keep returning to, and what each one actually changed about how I work or think. Most of them overlap more than they look like they should — the same habit of taking something apart to understand it shows up in cooking, training, and code alike.',
    accent: '#ff5c38',
    cards: [
      {
        title: 'Reading',
        body: 'Books, papers, and long-form articles worth finishing, with notes on the ideas that stuck rather than a summary of each one.',
      },
      {
        title: 'Building',
        body: 'Side projects in progress — this site, a home NAS, and a turn-based multiplayer game that has been on the list for a while. Notes on what each one taught me, including the parts that did not work.',
      },
      {
        title: 'Watching',
        body: 'Creators and channels that led to an actual change in how I train, cook, or build something, rather than just background viewing.',
      },
    ],
    note: 'Updated as things earn their place, so the list stays short rather than comprehensive.',
  },
}
