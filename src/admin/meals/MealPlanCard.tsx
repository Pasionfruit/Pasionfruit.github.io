import { useState } from 'react'
import { Pager } from '../../components/Pager'
import { dayKey } from '../calendarDays'
import { MEAL_LABELS, MEAL_SLOTS, setMeal, useMealPlan, weekStart } from './mealPlan'

/**
 * One week of meals, a row per day. Fields save as you leave them, so there is
 * no save button; the calendar's day panel reads the same plan.
 */
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
  const planned = days.reduce((total, { key }) => total + Object.keys(plan[key] ?? {}).length, 0)

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
            <h4>
              {date.toLocaleDateString(undefined, { weekday: 'short' })}
              <span>{date.toLocaleDateString(undefined, short)}</span>
            </h4>
            <div className="meal-slots">
              {MEAL_SLOTS.map((slot) => (
                <label key={slot} className="meal-slot">
                  <span>{MEAL_LABELS[slot]}</span>
                  <input
                    // Re-keyed on the saved value so an outside change shows up here.
                    key={plan[key]?.[slot] ?? ''}
                    type="text"
                    defaultValue={plan[key]?.[slot] ?? ''}
                    placeholder="—"
                    aria-label={`${MEAL_LABELS[slot]} on ${key}`}
                    onBlur={(event) => setMeal(key, slot, event.target.value)}
                  />
                </label>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </article>
  )
}
