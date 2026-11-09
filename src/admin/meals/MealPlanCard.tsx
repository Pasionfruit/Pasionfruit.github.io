import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Pager } from '../../components/Pager'
import { dayKey } from '../calendarDays'
import { addMeal, isFilled, removeMeal, updateMeal, useMealPlan, weekStart, type MealEntry } from './mealPlan'

/**
 * One week of plans, a row per day. A day holds named entries ("Thanksgiving")
 * and each lists its dishes, comma separated. Fields save as you leave them, so
 * there is no save button; the calendar's day panel reads the same plan.
 */
function MealRow({ dateKey, entry }: { dateKey: string; entry: MealEntry }) {
  const dishesText = entry.dishes.join(', ')

  // Both fields save together, from whichever one was just left.
  function save(title: string, dishes: string) {
    if (title.trim() !== entry.title || dishes.trim() !== dishesText) {
      updateMeal(dateKey, entry.id, { title, dishes })
    }
  }

  return (
    <div className="meal-entry">
      <input
        type="text"
        className="meal-entry-title"
        defaultValue={entry.title}
        placeholder="What, e.g. Thanksgiving"
        aria-label={`Meal name on ${dateKey}`}
        onBlur={(event) => {
          const dishes = event.currentTarget.parentElement?.querySelector<HTMLInputElement>('.meal-entry-dishes')
          save(event.target.value, dishes?.value ?? dishesText)
        }}
      />
      <input
        type="text"
        className="meal-entry-dishes"
        defaultValue={dishesText}
        placeholder="Dishes: turkey, ham, mac and cheese"
        aria-label={`Dishes on ${dateKey}`}
        onBlur={(event) => {
          const title = event.currentTarget.parentElement?.querySelector<HTMLInputElement>('.meal-entry-title')
          save(title?.value ?? entry.title, event.target.value)
        }}
      />
      <button
        type="button"
        className="meal-entry-remove"
        aria-label={`Remove ${entry.title || 'meal'} on ${dateKey}`}
        onClick={() => removeMeal(dateKey, entry.id)}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

export function MealPlanCard({ title }: { title: string }) {
  const plan = useMealPlan()
  const [start, setStart] = useState(() => weekStart(new Date()))

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    return { date, key: dayKey(date) }
  })
  const short = { month: 'short', day: 'numeric' } as const
  const label = `${start.toLocaleDateString(undefined, short)} – ${days[6].date.toLocaleDateString(undefined, short)}`
  const todayKey = dayKey(new Date())
  const planned = days.reduce((total, { key }) => total + (plan[key] ?? []).filter(isFilled).length, 0)

  function shiftWeek(weeks: number) {
    setStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + weeks * 7))
  }

  return (
    <article className="info-card admin-card admin-card-wide meal-plan-card">
      <div className="admin-card-head">
        <h3>{title}</h3>
        <div className="admin-card-actions">
          <span className="admin-pill">{planned} planned</span>
        </div>
      </div>

      <Pager
        variant="title"
        label={label}
        prevLabel="Previous week"
        nextLabel="Next week"
        onPrev={() => shiftWeek(-1)}
        onNext={() => shiftWeek(1)}
      />

      <ul className="meal-week">
        {days.map(({ date, key }) => (
          <li key={key} className={`meal-day ${key === todayKey ? 'is-today' : ''}`}>
            <div className="meal-day-head">
              <h4>
                {date.toLocaleDateString(undefined, { weekday: 'short' })}
                <span>{date.toLocaleDateString(undefined, short)}</span>
              </h4>
              <button
                type="button"
                className="meal-add"
                aria-label={`Add a meal on ${key}`}
                onClick={() => addMeal(key)}
              >
                <Plus size={13} aria-hidden="true" /> Add
              </button>
            </div>
            {(plan[key] ?? []).map((entry) => (
              <MealRow key={entry.id} dateKey={key} entry={entry} />
            ))}
          </li>
        ))}
      </ul>
    </article>
  )
}
