import type { NavSection, PageContent, SubpageContent } from './shared'

export const cookingNavSection: NavSection = {
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
}

export const cookingSectionPage: PageContent = {
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
}

export const cookingDetailPages: Record<string, SubpageContent> = {
  '/cooking/recipes': {
    eyebrow: 'Repeatable meals',
    title: 'Recipes',
    summary: 'A collection of meals I want to keep around because they are good, practical, or both',
    accent: '#e0a800',
    cards: [
      { title: 'Favorites', body: 'If account exists, favorite recipes will be saved here.' },
      {
        title: 'Recipes',
        body: 'Filterable total of all recipes: schema: calories, my video link, recipe website link, dish name, tools, needed, cook time, ingredients, instructions w dynamic incredients, follower rating, storage/fridge life',
      },
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
      { title: 'Meal Randomizer', body: '' },
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
      { title: 'Flavor Maxing', body: "How each ingredient actuary changes the dish's flavor" },
      {
        title: 'Important/personal lessons/tips',
        body: 'This can hold the trial-and-error that makes cooking better.',
      },
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
      {
        title: 'Cost Analysis',
        body: 'Compare grocery item prices across Walmart, Target, Publix, and Aldi.',
      },
      {
        title: 'Store Deals',
        body: 'Browse active deals and discounts per store.',
      },
      {
        title: 'Coupons',
        body: 'Track coupons for grocery stores and fast food places.',
      },
    ],
    note: '',
  },
}
