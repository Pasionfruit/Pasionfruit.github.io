import { foodTotals, type FoodItem } from './food'

const FIELDS = [
  { key: 'grams', label: 'g' },
  { key: 'protein_g', label: 'P' },
  { key: 'carbs_g', label: 'C' },
  { key: 'sugar_g', label: 'S' },
] as const

/** The model's guess at a meal, editable line by line, then added to today's totals. */
export function FoodReview({ items, onChange, onAdd, onClose }: {
  items: FoodItem[]
  onChange: (items: FoodItem[]) => void
  onAdd: (totals: { protein_g: number; carbs_g: number; sugar_g: number }) => void
  onClose: () => void
}) {
  const totals = foodTotals(items)
  const set = (index: number, patch: Partial<FoodItem>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  return (
    <section className="pg-review">
      <h4>Meal estimate</h4>
      {items.length === 0 ? (
        <p className="sheets-meta">No food found. Retake the photo closer, in better light.</p>
      ) : (
        <ul className="pg-food">
          {items.map((item, i) => (
            <li key={i}>
              <div className="pg-food-name">
                <input type="text" value={item.name} aria-label="Food" onChange={(e) => set(i, { name: e.target.value })} />
                <button type="button" className="secondary-action" aria-label={`Remove ${item.name}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>✕</button>
              </div>
              <div className="pg-food-nums">
                {FIELDS.map((f) => (
                  <label key={f.key}>
                    <span>{f.label}</span>
                    <input type="number" inputMode="decimal" min="0" value={item[f.key]} aria-label={`${item.name} ${f.key.replace('_g', '').replace('grams', 'grams')}`} onChange={(e) => set(i, { [f.key]: Math.max(0, Number(e.target.value) || 0) })} />
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="sheets-meta">Protein {totals.protein_g} g · carbs {totals.carbs_g} g · sugar {totals.sugar_g} g. A rough guess from the photo: weigh food for real numbers. Sugar here is total, not added.</p>
      <div className="pg-actions">
        <button type="button" className="primary-action" disabled={items.length === 0} onClick={() => onAdd(totals)}>Add to today</button>
        <button type="button" className="secondary-action" onClick={onClose}>Close</button>
      </div>
    </section>
  )
}
