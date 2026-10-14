import { describe, expect, it } from 'vitest'
import { assignPlanDates, parseWorkoutTable, weekdayIndex, workoutLines, workoutOneLine } from './workoutPlan'

// The plan exactly as it was pasted, Markdown source from a chat reply.
const PASTED_PLAN = `| Day | Morning | Evening |
|---|---|---|
| Wed | **Easy swim**<br>• 100m breast<br>• 4×50m free<br>• 2×50m breast<br>• 4×50m free<br>• 4×50m pull buoy<br>• 100m choice | Legs |
| Thu | **Quality run**<br>• 10min easy<br>• 4×4min RPE 6–7<br>• 2min easy between<br>• 8–10min cooldown | Chest & Back |
| Fri | **Long swim**<br>• 4×50m easy<br>• 4×75m free<br>• 2×100m free<br>• 2×50m pull buoy<br>• 100m choice | Arms |
| Sat | **Long run**<br>• 5min warm-up<br>• 60min easy/run–walk<br>• 5min cooldown | Rest |
| Sun | **Long bike**<br>• 10min easy<br>• 55min Zone 2<br>• 10min cooldown | Rest |`

/** Local-time date, so the tests do not depend on the machine's time zone. */
function day(year: number, month: number, date: number) {
  return new Date(year, month - 1, date)
}

describe('parseWorkoutTable', () => {
  it('reads the pasted Markdown plan into one entry per day', () => {
    const { days, skipped, error } = parseWorkoutTable(PASTED_PLAN)

    expect(error).toBeUndefined()
    expect(skipped).toEqual([])
    expect(days.map((d) => d.weekday)).toEqual([3, 4, 5, 6, 0])
    expect(days[0].morning).toBe(
      '**Easy swim**\n• 100m breast\n• 4×50m free\n• 2×50m breast\n• 4×50m free\n• 4×50m pull buoy\n• 100m choice',
    )
    expect(days[0].evening).toBe('Legs')
    expect(days[1].evening).toBe('Chest & Back')
    expect(days[4].morning).toBe('**Long bike**\n• 10min easy\n• 55min Zone 2\n• 10min cooldown')
  })

  it('finds the columns by header, whatever their order', () => {
    const { days } = parseWorkoutTable('| Evening | Day | Morning |\n| :--- | :---: | ---: |\n| Arms | Fri | Swim |')

    expect(days).toEqual([{ weekday: 5, morning: 'Swim', evening: 'Arms' }])
  })

  it('takes day, morning, evening when there is no header row', () => {
    const { days } = parseWorkoutTable('Wednesday | Bike | Legs\nThurs | Run<br/>• 5k | Rest')

    expect(days).toEqual([
      { weekday: 3, morning: 'Bike', evening: 'Legs' },
      { weekday: 4, morning: 'Run\n• 5k', evening: 'Rest' },
    ])
  })

  it('reports rows without a weekday instead of dropping them silently', () => {
    const { days, skipped } = parseWorkoutTable('| Day | Morning | Evening |\n|---|---|---|\n| Mon | Swim | Legs |\n| Total | 3h | |')

    expect(days).toHaveLength(1)
    expect(skipped).toEqual(['Total'])
  })

  it('explains when there is nothing to read', () => {
    expect(parseWorkoutTable('swim on wednesday').error).toMatch(/No workout rows found/)
    expect(parseWorkoutTable('| Day | Morning | Evening |\n|---|---|---|').error).toMatch(/No workout rows found/)
  })

  it('reads a rendered mobile table copied with tabs and reordered headers', () => {
    expect(parseWorkoutTable('Evening\tDay\tMorning\r\nLegs\tWednesday\tSwim\r\nRest\tThu\tRun').days).toEqual([
      { weekday: 3, morning: 'Swim', evening: 'Legs' },
      { weekday: 4, morning: 'Run', evening: 'Rest' },
    ])
  })

  it('preserves quoted multiline cells and empty cells in copied tables', () => {
    expect(parseWorkoutTable('Day\tMorning\tEvening\nWed\t"Easy swim\n• 4×50m free"\t\nThu\t\tLegs').days).toEqual([
      { weekday: 3, morning: 'Easy swim\n• 4×50m free', evening: '' },
      { weekday: 4, morning: '', evening: 'Legs' },
    ])
  })

  it('preserves every workout and bullet in the supplied mobile table', () => {
    const plan = `Day\tMorning\tAfternoon
Monday\tLegs\tTechnique swim: 700 m
• 100 m breast
• 4 × 25 m free — controlled breathing
• 4 × 50 m free
• 4 × 50 m pull buoy
• 100 m easy choice
• Rest: 20–30 sec between repeats
Tuesday\tChest & Tri & Shoulders\tQuality run: 35 min
• 10 min easy
• 5 × (1 min brisk + 2 min easy jog/walk)
• 10 min easy
• Brisk: 6–7/10 effort
• Completed 39-min 5K replaces this session
Wednesday\tBack & Bi & Forearms\tEasy swim: 800 m
• 100 m breast
• 4 × 50 m free
• 2 × 50 m breast
• 4 × 50 m free
• 2 × 50 m pull buoy
• 100 m easy choice
• Rest: 20–30 sec between repeats
Thursday\tChest & Back\tEasy run: 30 min
• 5 min easy walk/jog
• 20 min conversational run/walk
• 5 min easy walk/jog
• Walk breaks as needed
Friday\tArms\tLong swim: 900 m
• 100 m breast
• 6 × 100 m — free or 50 m free + 50 m breast
• 2 × 50 m pull buoy
• 100 m easy choice
• Rest: 30–45 sec between repeats
• Split 100 m repeats into 2 × 50 m if form deteriorates
Saturday\tRest\tLong run: 65 min
• 5 min easy walk
• 55 min conversational run/walk
• 5 min easy walk
• Walk breaks as needed
• Cap total at last week’s duration + 5 min
Sunday\tRest\tLong bike: 75 min
• 10 min easy
• 55 min conversational effort
• 10 min easy
• Pause as needed
• Rest instead if fatigue or soreness persists`
    const { days, skipped, error } = parseWorkoutTable(plan)

    expect(error).toBeUndefined()
    expect(skipped).toEqual([])
    expect(days.map((entry) => entry.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0])
    expect(days.map((entry) => entry.morning)).toEqual([
      'Legs', 'Chest & Tri & Shoulders', 'Back & Bi & Forearms', 'Chest & Back', 'Arms', 'Rest', 'Rest',
    ])
    expect(days.map((entry) => entry.evening.split('\n')[0])).toEqual([
      'Technique swim: 700 m', 'Quality run: 35 min', 'Easy swim: 800 m', 'Easy run: 30 min',
      'Long swim: 900 m', 'Long run: 65 min', 'Long bike: 75 min',
    ])
    expect(days.map((entry) => entry.evening.split('\n').length - 1)).toEqual([6, 5, 7, 4, 6, 5, 5])
    expect(days[0].evening).toBe('Technique swim: 700 m\n• 100 m breast\n• 4 × 25 m free — controlled breathing\n• 4 × 50 m free\n• 4 × 50 m pull buoy\n• 100 m easy choice\n• Rest: 20–30 sec between repeats')
    expect(days[6].evening).toBe('Long bike: 75 min\n• 10 min easy\n• 55 min conversational effort\n• 10 min easy\n• Pause as needed\n• Rest instead if fatigue or soreness persists')
  })

  it('finds the Afternoon column even when copied columns are reordered', () => {
    expect(parseWorkoutTable('Afternoon\tMorning\tDay\nSwim\tLegs\tMon').days).toEqual([
      { weekday: 1, morning: 'Legs', evening: 'Swim' },
    ])
  })

  it('reads stacked mobile cards with multiline workouts and AM/PM labels', () => {
    const plan = [
      '**Wednesday**', '**Morning:** Easy swim', '• 4×50m free', '**Evening:** Legs',
      'Thursday', 'Morning workout', 'Morning run', '• 5k', 'Evening workout', 'Rest',
      'Fri', 'AM: Bike', 'PM:',
    ].join('\n')
    expect(parseWorkoutTable(plan)).toEqual({
      days: [
        { weekday: 3, morning: 'Easy swim\n• 4×50m free', evening: 'Legs' },
        { weekday: 4, morning: 'Morning run\n• 5k', evening: 'Rest' },
        { weekday: 5, morning: 'Bike', evening: '' },
      ],
      skipped: [],
    })
  })
})

describe('weekdayIndex', () => {
  it('accepts short, long and bolded day names', () => {
    expect(weekdayIndex('Sun')).toBe(0)
    expect(weekdayIndex('**Tuesday**')).toBe(2)
    expect(weekdayIndex(' thurs ')).toBe(4)
    expect(weekdayIndex('Day')).toBe(-1)
  })
})

describe('assignPlanDates', () => {
  it('fits a Monday–Sunday plan into the next seven days when pasted on Tuesday', () => {
    const days = [1, 2, 3, 4, 5, 6, 0].map((weekday) => ({ weekday, morning: '', evening: '' }))
    const dated = assignPlanDates(days, day(2026, 10, 6))
    expect(dated.map((entry) => entry.date)).toEqual([
      day(2026, 10, 12), day(2026, 10, 6), day(2026, 10, 7), day(2026, 10, 8),
      day(2026, 10, 9), day(2026, 10, 10), day(2026, 10, 11),
    ])
  })

  it('puts a Wed–Sun plan pasted on a Tuesday on the coming Wed–Sun', () => {
    const { days } = parseWorkoutTable(PASTED_PLAN)
    const dated = assignPlanDates(days, day(2026, 10, 6))

    expect(dated.map((d) => d.date)).toEqual([
      day(2026, 10, 7),
      day(2026, 10, 8),
      day(2026, 10, 9),
      day(2026, 10, 10),
      day(2026, 10, 11),
    ])
  })

  it("starts today when the plan's first day is today", () => {
    const dated = assignPlanDates([{ weekday: 2, morning: 'Swim', evening: '' }], day(2026, 10, 6))

    expect(dated[0].date).toEqual(day(2026, 10, 6))
  })

  it('moves a repeated day on to the following week', () => {
    const dated = assignPlanDates(
      [
        { weekday: 1, morning: 'A', evening: '' },
        { weekday: 1, morning: 'B', evening: '' },
      ],
      day(2026, 10, 6),
    )

    expect(dated.map((d) => d.date)).toEqual([day(2026, 10, 12), day(2026, 10, 19)])
  })
})

describe('workoutLines / workoutOneLine', () => {
  it('splits a stored workout into a bold title and bullet items', () => {
    const lines = workoutLines('**Easy swim**\n• 100m breast\n- 4×50m free')

    expect(lines).toEqual([
      { kind: 'text', segments: [{ text: 'Easy swim', bold: true }] },
      { kind: 'item', segments: [{ text: '100m breast', bold: false }] },
      { kind: 'item', segments: [{ text: '4×50m free', bold: false }] },
    ])
  })

  it('flattens a multi-line workout for one-line contexts', () => {
    expect(workoutOneLine('**Easy swim**\n• 100m breast\n• 4×50m free')).toBe('Easy swim: 100m breast; 4×50m free')
    expect(workoutOneLine('Legs')).toBe('Legs')
    expect(workoutOneLine('')).toBe('')
  })
})
