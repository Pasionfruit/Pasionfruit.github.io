import { aceJson, getAceConfig } from '../admin/ace/client'
import { prepareImage, skinVisionModel } from './detect'

export type FoodItem = { name: string; grams: number; protein_g: number; carbs_g: number; sugar_g: number }

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          protein_g: { type: 'number' },
          carbs_g: { type: 'number' },
          sugar_g: { type: 'number' },
        },
        required: ['name', 'grams', 'protein_g', 'carbs_g', 'sugar_g'],
      },
    },
  },
  required: ['items'],
}

const MAX_ITEMS = 12

const clean = (n: unknown, max: number) => {
  const v = Number(n)
  return Number.isFinite(v) && v >= 0 ? Math.min(Math.round(v), max) : 0
}

/** Keep only plausible rows, so a rambling model cannot add 40 kg of rice. */
export function parseFood(raw: { items?: Partial<Record<keyof FoodItem, unknown>>[] } | null | undefined): FoodItem[] {
  return (raw?.items ?? [])
    .map((i) => ({
      name: String(i.name ?? '').trim().slice(0, 60),
      grams: clean(i.grams, 2000),
      protein_g: clean(i.protein_g, 200),
      carbs_g: clean(i.carbs_g, 400),
      sugar_g: clean(i.sugar_g, 200),
    }))
    .filter((i) => i.name && i.grams > 0)
    .slice(0, MAX_ITEMS)
}

export function foodTotals(items: FoodItem[]) {
  return items.reduce(
    (t, i) => ({ protein_g: t.protein_g + i.protein_g, carbs_g: t.carbs_g + i.carbs_g, sugar_g: t.sugar_g + i.sugar_g }),
    { protein_g: 0, carbs_g: 0, sugar_g: 0 },
  )
}

/** A rough first estimate from the local model, for the user to correct. Not a substitute for weighing food. */
export async function estimateMeal(idToken: string, photo: Blob): Promise<FoodItem[]> {
  const base = getAceConfig()
  if (!base) throw new Error('Ace is not configured (VITE_ACE_BASE_URL), so there is no local model to ask.')
  const { data } = await prepareImage(photo)
  const result = await aceJson<{ items?: Partial<Record<keyof FoodItem, unknown>>[] }>({
    config: { ...base, model: skinVisionModel() },
    idToken,
    format: SCHEMA,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content:
          'This is a photo of a meal. List each distinct food you can see with an estimated weight in grams and its protein, ' +
          'carbohydrate and sugar in grams for that weight. Be realistic about portion size. Include visible sauces or oils as their own item. ' +
          'Return JSON {"items":[{"name":"","grams":0,"protein_g":0,"carbs_g":0,"sugar_g":0}]}.',
        images: [data],
      },
    ],
  })
  return parseFood(result)
}
