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
  summary:
    'Cooking for one on a work schedule is mostly a logistics problem. These pages are how I solve it: a short list of meals that reliably work, a weekly plan that turns them into one grocery trip, technique notes so the same mistakes stop repeating, and price tracking across four stores because the same cart is not the same price everywhere.',
  accent: '#f59e0b',
  cards: [
    {
      title: 'Meal Plan for the Day',
      body: "Today's breakfast, lunch, and dinner pulled from the weekly plan.",
    },
  ],
  callout:
    'The rule for anything that lands here: it has to be cookable on a weeknight, use ingredients I can actually find locally, and be worth making a second time.',
}

export const cookingDetailPages: Record<string, SubpageContent> = {
  '/cooking/recipes': {
    eyebrow: 'Repeatable meals',
    title: 'Recipes',
    summary:
      'Meals I keep because they are good, practical, or cheap — ideally two of the three. Each one records cook time, the tools it actually needs, how long leftovers keep, and what I would change next time. A recipe only stays on this list if I have cooked it more than once.',
    accent: '#f59e0b',
    cards: [
      {
        title: 'Favorites',
        body: 'Signed-in visitors can pin the recipes they come back to, so the short list stays short.',
      },
      {
        title: 'Recipes',
        body: 'The full collection, filterable by cook time, calories, and equipment needed. Each entry carries its ingredient list, instructions that scale with serving size, and fridge life.',
      },
      {
        title: 'Randomizer',
        body: 'For the nights when deciding is the hard part — picks a meal from the list for you.',
      },
    ],
    note: 'Ingredient amounts scale with serving count, and units switch between metric and imperial. You can check off ingredients you already have and steps as you go.',
  },
  '/cooking/plan': {
    eyebrow: 'Weekly prep',
    title: 'Meal Plan',
    summary:
      'One planning pass at the start of the week beats seven decisions at 7pm. This page maps what gets cooked on which night, rolls the ingredients up into a single grocery list, and totals what the week costs and what it adds up to nutritionally.',
    accent: '#f59e0b',
    cards: [
      {
        title: 'Receipt',
        body: 'What the week actually costs, plus the nutrition totals the plan works out to.',
      },
      {
        title: 'Grocery list',
        body: 'Every ingredient in the week rolled into one list, grouped so a single trip covers it.',
      },
      {
        title: 'Meal Randomizer',
        body: 'Fills an open slot in the week when nothing obvious comes to mind.',
      },
      {
        title: 'Meal Plan for the Week',
        body: 'The full Monday-through-Sunday layout of breakfast, lunch, and dinner.',
      },
    ],
    note: 'The plan is meant to be edited mid-week. Nights get skipped, leftovers stretch further than expected, and the grocery list updates when they do.',
  },
  '/cooking/learn': {
    eyebrow: 'Kitchen skills',
    title: 'Cooking Learn',
    summary:
      'The part of cooking that transfers between recipes. Most of what improved my food was not a new recipe but understanding why a step exists — why the pan needs to be that hot, why the acid goes in at the end, why resting matters.',
    accent: '#f59e0b',
    cards: [
      {
        title: 'Technique Tips',
        body: 'Heat control, seasoning in layers, knife work, and the handful of techniques that improved the most dishes at once.',
      },
      {
        title: 'Flavor Maxing',
        body: 'What each ingredient is actually contributing — acid, fat, salt, sweetness, or aroma — and how to tell which one a dish is missing.',
      },
      {
        title: 'Important/personal lessons/tips',
        body: 'The trial and error: dishes I have ruined, why, and what fixed them. Mostly a record so I stop repeating the same mistakes.',
      },
      {
        title: 'Learn',
        body: 'A Gemini notebook of collected sources I use when reading up on a technique in more depth.',
      },
      {
        title: 'Equipment',
        body: 'The tools that earned their counter space, and the ones that did not.',
      },
    ],
    note: 'Written for future-me standing in a kitchen, so the notes stay practical rather than encyclopedic.',
  },
  '/cooking/deals': {
    eyebrow: 'Value watch',
    title: 'Cooking Deals',
    summary:
      'The same grocery cart can swing meaningfully between stores in the same week, and the gap is rarely where you would guess. This page tracks prices across Walmart, Target, Publix, and Aldi, alongside the current circular deals and manufacturer coupons, refreshed daily.',
    accent: '#f59e0b',
    cards: [
      {
        title: 'Cost Analysis',
        body: 'Item-by-item price comparison across Walmart, Target, Publix, and Aldi, so it is clear which trip is actually worth making.',
      },
      {
        title: 'Store Deals',
        body: 'Active weekly circular deals and discounts, broken out per store.',
      },
      {
        title: 'Coupons',
        body: 'Grocery manufacturer coupons and fast food offers, pulled daily from Flipp and Slickdeals.',
      },
    ],
    note: 'Prices are collected automatically each day and reflect local stores, so a listing can lag a same-day change in-store.',
  },
}
