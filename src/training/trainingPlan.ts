import type { TrainingRecord } from '../data/sheets/types'
import { toDateOnlyKey } from './workoutsOfDay'

/**
 * The Half Marathon to Lavaman plan, Sep 28 2026 to Apr 4 2027, from the final
 * training plan. It ships with the site so the Training card and Ace always
 * know the schedule without anyone pasting it each week.
 *
 * A row in the training log for a date wins over the plan for that date, so
 * pasting a week still overrides it. Weeks 1-4 lift in the morning and
 * endurance is in the afternoon; from Week 5 endurance is in the morning and
 * strength in the evening.
 */

export const TRAINING_PLAN_START = new Date(2026, 8, 28)
const REST = 'Rest day'
const LAST_STRENGTH_FIRST_WEEK = 4

const bullets = (title: string, items: string[]) => [`**${title}**`, ...items.map((item) => `• ${item}`)].join('\n')

const LIFTS = {
  mon: {
    title: 'Chest & Tri & Shoulders',
    items: ['Bench press 3×6-8', 'Incline dumbbell press 2×8-12', 'Dumbbell shoulder press 2×8-10', 'Lateral raise 2×12-15', 'Triceps pressdown 2×10-15'],
  },
  tue: {
    title: 'Back & Bi & Forearms',
    items: ['Lat pulldown or assisted pull-up 3×8-10', 'Chest-supported row 3×8-12', 'Dumbbell curl 2×10-12', 'Hammer curl 2×10-12', 'Farmer carry 2×30-45 sec'],
  },
  wed: {
    title: 'Legs',
    items: ['Squat or leg press 2×6-8', 'Romanian deadlift 2×8-10', 'Split squat or step-up 2×8 each leg', 'Leg curl 2×10-12', 'Calf raise, if comfortable 2×12-15'],
  },
  thu: {
    title: 'Chest & Back',
    items: ['Incline press 2×8-10', 'Cable or machine row 2×8-12', 'Chest fly 2×10-15', 'Lat pulldown 2×10-12'],
  },
  fri: {
    title: 'Arms',
    items: ['Cable curl 2×10-12', 'Triceps pressdown 2×10-12', 'Hammer curl 2×10-12', 'Overhead triceps extension 2×10-12'],
  },
}

type LiftDay = keyof typeof LIFTS

/** `note` adds one line, e.g. "Half the working sets" in a recovery week. */
function lift(day: LiftDay, note?: string) {
  const { title, items } = LIFTS[day]
  return bullets(title, note ? [...items, note] : items)
}

const OPTIONAL_UPPER = bullets('Optional light upper body', [])
const LIGHT_LEGS = bullets('Legs: light', ['1 set per exercise'])
const HALF = 'Half the working sets'

type DayPlan = { endurance: string; lift: string }
const day = (endurance: string, strength: string): DayPlan => ({ endurance, lift: strength })

// ── Weeks ────────────────────────────────────────────────────────────────────
// Each week is seven days, Monday to Sunday.

const WEEK_1: DayPlan[] = [
  day(bullets('Technique swim', ['100m easy warm-up', '2×50m: 25m gentle kickboard + 25m easy freestyle', '2×50m pull buoy', '4×50m controlled freestyle', '100m easy cool-down', 'Total 600m']), lift('mon')),
  day(bullets('Quality run', ['10 min easy warm-up', '4×(2 min controlled + 2 min easy walk/jog)', '5 min easy cool-down', 'Total 31 min; work RPE 5-6/10']), lift('tue')),
  day(bullets('Easy swim', ['100m easy warm-up', '8×50m relaxed freestyle', '100m easy cool-down', 'Total 600m']), lift('wed')),
  day(bullets('Easy run', ['30 min conversational run/walk', 'RPE 3-4/10; no pace target']), lift('thu')),
  day(bullets('Endurance swim', ['100m easy warm-up', '10×50m controlled freestyle', '100m easy cool-down', 'Total 700m']), lift('fri')),
  day(bullets('Long run', ['55 min easy run/walk', 'Practice familiar fuel if over 75-90 min']), REST),
  day(bullets('Easy bike (optional)', ['60 min easy bike', 'Take a full rest day if tired']), REST),
]

const WEEK_2: DayPlan[] = [
  day(bullets('Technique swim', ['100m easy warm-up', '2×50m: 25m gentle kickboard + 25m easy freestyle', '2×50m pull buoy', '5×50m controlled freestyle', '100m easy cool-down', 'Total 650m']), lift('mon')),
  day(bullets('Quality run', ['10 min easy warm-up', '5×(2 min controlled + 2 min easy walk/jog)', '5 min easy cool-down', 'Total 35 min; work RPE 5-6/10']), lift('tue')),
  day(bullets('Easy swim', ['100m easy warm-up', '10×50m relaxed freestyle', '100m easy cool-down', 'Total 700m']), lift('wed')),
  day(bullets('Easy run', ['30 min conversational run/walk', 'RPE 3-4/10; no pace target']), lift('thu')),
  day(bullets('Endurance swim', ['100m easy warm-up', '12×50m controlled freestyle', '100m easy cool-down', 'Total 800m']), lift('fri')),
  day(bullets('Long run', ['60 min easy run/walk', 'Practice familiar fuel if over 75-90 min']), REST),
  day(bullets('Easy bike (optional)', ['70 min easy bike', 'Take a full rest day if tired']), REST),
]

const WEEK_3: DayPlan[] = [
  day(bullets('Technique swim', ['100m easy warm-up', '2×50m: 25m gentle kickboard + 25m easy freestyle', '2×50m pull buoy', '6×50m controlled freestyle', '100m easy cool-down', 'Total 700m']), lift('mon')),
  day(bullets('Quality run', ['10 min easy warm-up', '5×(2 min controlled + 2 min easy walk/jog)', '5 min easy cool-down', 'Total 35 min; work RPE 5-6/10', 'Do not repeat the 39-min 5K as a test']), lift('tue')),
  day(bullets('Easy swim', ['100m easy warm-up', '12×50m relaxed freestyle', '100m easy cool-down', 'Total 800m']), lift('wed')),
  day(bullets('Easy run', ['30 min conversational run/walk', 'RPE 3-4/10; no pace target']), lift('thu')),
  day(bullets('Endurance swim', ['100m easy warm-up', '14×50m controlled freestyle', '100m easy cool-down', 'Total 900m']), lift('fri')),
  day(bullets('Long run', ['65 min easy run/walk', 'Practice familiar fuel if over 75-90 min']), REST),
  day(bullets('Easy bike (optional)', ['75 min easy bike', 'Take a full rest day if tired']), REST),
]

const WEEK_4: DayPlan[] = [
  day(bullets('Technique swim', ['100m easy warm-up', '2×50m: 25m gentle kickboard + 25m easy freestyle', '2×50m pull buoy', '4×50m controlled freestyle', '100m easy cool-down', 'Total 600m']), lift('mon', HALF)),
  day(bullets('Quality run', ['8 min easy warm-up', '4×(2 min controlled + 2 min easy walk/jog)', '10 min easy cool-down', 'Total 34 min; controlled effort']), lift('tue', HALF)),
  day(bullets('Easy swim', ['100m easy warm-up', '8×50m relaxed freestyle', '100m easy cool-down', 'Total 600m']), lift('wed', HALF)),
  day(bullets('Easy run', ['30 min conversational run/walk', 'RPE 3-4/10; no pace target']), lift('thu', HALF)),
  day(bullets('Endurance swim + breathing practice', ['100m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '8×50m controlled freestyle', '100m easy cool-down', 'Total 700m']), lift('fri', HALF)),
  day(bullets('Long run', ['60 min easy run/walk', 'Practice familiar fuel if over 75-90 min']), REST),
  day(bullets('Easy bike (optional)', ['45 to 60 min easy bike', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_5: DayPlan[] = [
  day(bullets('Technique swim', ['100m easy warm-up', '4×50m: 25m skill A (exhale + low breath) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '6×50m controlled freestyle', '100m easy cool-down', 'Total 900m']), lift('mon', HALF)),
  day(bullets('Run form practice', ['8 min warm-up R', '4×(20 sec smooth easy running / 40 sec walk)', '24 min easy run/walk', 'Total 36 min; no hard intervals']), lift('tue', HALF)),
  day(bullets('Easy swim', ['100m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '8×50m relaxed freestyle', '100m easy cool-down', 'Total 800m']), lift('wed', HALF)),
  day(bullets('Easy run', ['30 min conversational run/walk', 'First 8 min: running form warm-up R (included)']), lift('thu', HALF)),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '12×50m controlled freestyle', '100m easy cool-down', 'Total 1,000m']), lift('fri', HALF)),
  day(bullets('Long run', ['60 min easy run/walk', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Easy bike', ['45 to 60 min easy bike', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_6: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill A / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '6×50m controlled freestyle', '100m easy cool-down', 'Total 1,000m']), lift('mon')),
  day(bullets('Run form practice', ['8 min warm-up R', '4×(20 sec smooth easy running / 40 sec walk)', '23 min easy run/walk', 'Total 35 min; no hard intervals']), lift('tue')),
  day(bullets('Easy swim', ['100m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '10×50m relaxed freestyle', '100m easy cool-down', 'Total 900m']), lift('wed')),
  day(bullets('Easy run', ['35 min conversational run/walk', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '7×100m controlled freestyle', '100m easy cool-down', 'Total 1,100m']), lift('fri')),
  day(bullets('Long run', ['75 min easy run/walk', 'Practice familiar fuel', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['60 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_7: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill A / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '4×100m controlled freestyle', '100m easy cool-down', 'Total 1,100m']), lift('mon')),
  day(bullets('Controlled goal-pace check', ['10 min easy warm-up including form warm-up R', '3×(6 min near 12:35/mile + 3 min easy walk/jog)', '5 min easy cool-down; total 42 min', 'Work RPE ≤6/10; slow down if strained. No time trial.']), lift('tue')),
  day(bullets('Easy swim', ['100m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '5×100m relaxed freestyle', '100m easy cool-down', 'Total 900m']), lift('wed')),
  day(bullets('Easy run', ['40 min conversational run/walk', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '8×100m controlled freestyle', '100m easy cool-down', 'Total 1,200m']), lift('fri')),
  day(bullets('Peak long run', ['95 min easy run/walk; up to 105 only if the prior long run and recovery were comfortable', 'Practice familiar fuel and planned walk breaks', 'Endurance check, not a race-pace test']), REST),
  day(bullets('Long bike', ['60 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_8: DayPlan[] = [
  day(bullets('Technique swim', ['100m easy warm-up', '4×50m: 25m skill B (relaxed recovery) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '3×100m controlled freestyle', '100m easy cool-down', 'Total 900m']), lift('mon')),
  day(bullets('Quality run', ['10 min easy warm-up, including warm-up R', '3×(3 min controlled + 2 min easy walk/jog)', '5 min easy cool-down', 'Total 30 min; work RPE 5-6/10']), lift('tue')),
  day(bullets('Easy swim', ['100m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '4×100m relaxed freestyle', '100m easy cool-down', 'Total 800m']), LIGHT_LEGS),
  day(bullets('Easy run', ['35 min conversational run/walk', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '6×100m controlled freestyle', '100m easy cool-down', 'Total 1,000m']), lift('fri')),
  day(bullets('Taper long run', ['75 min easy run/walk', 'Reduce fatigue; no fast finish or extra distance']), REST),
  day(bullets('Long bike', ['40 min easy bike', 'RPE 3-4/10; steady, comfortable effort']), REST),
]

const WEEK_9: DayPlan[] = [
  day(bullets('Technique swim', ['100m easy warm-up', '2×50m: 25m skill A / 25m relaxed freestyle', '2×50m pull buoy', '1×100m controlled freestyle', '100m easy cool-down', 'Total 500m']), OPTIONAL_UPPER),
  day(bullets('Easy run + gentle pickups', ['10 min easy', '3×(1 min relaxed brisk / 2 min easy)', '5 min easy', 'Total 24 min; no hard intervals']), OPTIONAL_UPPER),
  day(bullets('Easy swim', ['100m easy warm-up', '2×100m relaxed freestyle', '100m easy cool-down', 'Total 400m']), REST),
  day(bullets('Easy run', ['20 min conversational run/walk', 'RPE 3-4/10; no pace target']), REST),
  day(bullets('Optional shakeout', ['Rest, or 10 min very easy walk/jog if familiar', 'Prepare race gear; no lifting']), REST),
  day(bullets('HALF MARATHON: Saturday Nov 28', ['13.1 miles / 21.1 km', 'Sub-2:45 is conditional: average faster than 12:35/mile including stops', 'Use controlled effort; switch to comfortable completion if needed']), REST),
  day(bullets('Rest / recovery', ['Full rest; gentle walking as comfortable', 'No cycling']), REST),
]

const WEEK_10: DayPlan[] = [
  day(bullets('Rest / recovery', ['Gentle walking as comfortable']), REST),
  day(bullets('Recovery walk', ['20-30 min easy walk', 'No quality session']), OPTIONAL_UPPER),
  day(bullets('Easy swim', ['100m easy warm-up', '3×100m relaxed freestyle', '100m easy cool-down', 'Total 500m']), REST),
  day(bullets('Easy run (optional)', ['Up to 20 min only if walking and stairs are comfortable; otherwise walk/rest']), OPTIONAL_UPPER),
  day(bullets('Endurance swim', ['100m easy warm-up', '2×200m controlled freestyle', '100m easy cool-down', 'Total 600m']), REST),
  day(bullets('Easy run (optional)', ['Up to 30 min easy only if recovered; otherwise rest']), REST),
  day(bullets('Long bike', ['40 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_11: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill B (relaxed recovery) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '3×100m controlled freestyle', '100m easy cool-down', 'Total 1,000m']), lift('mon', 'Optional today')),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '3×(4 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 41 min; then 10 min easy run/walk', 'Back-pain rule overrides time and intensity']), lift('tue')),
  day(bullets('Easy swim', ['100m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '4×100m relaxed freestyle', '100m easy cool-down', 'Total 800m']), lift('wed')),
  day(bullets('Easy run', ['30 min conversational run/walk', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '4×200m controlled freestyle', '100m easy cool-down', 'Total 1,200m']), lift('fri', 'Optional today')),
  day(bullets('Long run', ['45 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['65 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_12: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill C (compact two-beat kick) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '4×100m controlled freestyle', '100m easy cool-down', 'Total 1,100m']), lift('mon', 'Optional today')),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '3×(4 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 41 min; then 10 min easy run/walk', 'Back-pain rule overrides time and intensity']), lift('tue')),
  day(bullets('Easy swim', ['100m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '5×100m relaxed freestyle', '100m easy cool-down', 'Total 900m']), lift('wed')),
  day(bullets('Easy run', ['35 min conversational run/walk', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '4×200m controlled freestyle', '150m easy freestyle', '100m easy cool-down', 'Total 1,350m']), lift('fri', 'Optional today')),
  day(bullets('Long run', ['50 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['75 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_13: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill A (exhale + low breath) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '5×100m controlled freestyle', '100m easy cool-down', 'Total 1,200m']), lift('mon', 'Optional today')),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '3×(4 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 41 min; then 10 min easy run/walk', 'Back-pain rule overrides time and intensity']), lift('tue')),
  day(bullets('Easy swim', ['200m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '5×100m relaxed freestyle', '100m easy cool-down', 'Total 1,000m']), lift('wed')),
  day(bullets('Easy run', ['35 min conversational run/walk', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '5×200m controlled freestyle', '200m easy cool-down', 'Total 1,500m']), lift('fri', 'Optional today')),
  day(bullets('Long run', ['55 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['85 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_14: DayPlan[] = [
  day(bullets('Technique swim', ['100m easy warm-up', '4×50m: 25m skill B (relaxed recovery) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '2×100m controlled freestyle', '100m easy cool-down', 'Total 800m']), lift('mon', `${HALF}; optional`)),
  day(bullets('Quality bike + easy brick', ['35 min easy bike; no intervals', 'Optional 10 min easy transition run if fresh', 'Back-pain rule overrides time and intensity']), lift('tue', HALF)),
  day(bullets('Easy swim', ['100m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '4×100m relaxed freestyle', '100m easy cool-down', 'Total 700m']), lift('wed', HALF)),
  day(bullets('Easy run', ['30 min conversational run/walk', 'First 8 min: running form warm-up R (included)']), lift('thu', HALF)),
  day(bullets('Endurance swim', ['100m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '2×300m controlled freestyle', '100m easy cool-down', 'Total 900m']), lift('fri', `${HALF}; optional`)),
  day(bullets('Long run', ['40 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['60 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_15: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill C (compact two-beat kick) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '4×100m controlled freestyle', '100m easy cool-down', 'Total 1,100m']), lift('mon', 'Optional today')),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '3×(4 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 41 min; then 10 min easy run/walk', 'Back-pain rule overrides time and intensity']), lift('tue')),
  day(bullets('Easy swim', ['100m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '5×100m relaxed freestyle', '100m easy cool-down', 'Total 900m']), lift('wed')),
  day(bullets('Easy run + optional easy bike', ['40 min easy run/walk', 'Optional 30 min easy bike, separate from run; skip it first if fatigue rises', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '3×300m controlled freestyle', '100m easy cool-down', 'Total 1,300m']), lift('fri', 'Optional today')),
  day(bullets('Long run', ['60 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['95 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_16: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill A (exhale + low breath) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '5×100m controlled freestyle', '100m easy cool-down', 'Total 1,200m']), lift('mon', 'Optional today')),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '3×(4 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 41 min; then 15 min easy run/walk', 'Back-pain rule overrides time and intensity']), lift('tue')),
  day(bullets('Easy swim', ['200m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '5×100m relaxed freestyle', '100m easy cool-down', 'Total 1,000m']), lift('wed')),
  day(bullets('Easy run + optional easy bike', ['40 min easy run/walk', 'Optional 30 min easy bike, separate from run; skip it first if fatigue rises', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '3×300m controlled freestyle', '100m easy freestyle', '100m easy cool-down', 'Total 1,400m']), lift('fri', 'Optional today')),
  day(bullets('Long run', ['65 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['105 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_17: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill B (relaxed recovery) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '6×100m controlled freestyle', '100m easy cool-down', 'Total 1,300m']), lift('mon', 'Optional today')),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '3×(4 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 41 min; then 15 min easy run/walk', 'Back-pain rule overrides time and intensity']), lift('tue')),
  day(bullets('Easy swim', ['200m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '6×100m relaxed freestyle', '100m easy cool-down', 'Total 1,100m']), lift('wed')),
  day(bullets('Easy run + optional easy bike', ['45 min easy run/walk', 'Optional 30 min easy bike, separate from run; skip it first if fatigue rises', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '3×300m controlled freestyle', '100m easy freestyle', '200m easy cool-down', 'Total 1,500m', 'When comfortable with 400-600m pool repeats, arrange a supported open-water session when conditions allow']), lift('fri', 'Optional today')),
  day(bullets('Long run', ['70 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['115 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_18: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill C (compact two-beat kick) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '3×100m controlled freestyle', '100m easy cool-down', 'Total 1,000m']), lift('mon', `${HALF}; optional`)),
  day(bullets('Quality bike + easy brick', ['35 min easy bike; no intervals', 'Optional 10 min easy transition run if fresh', 'Back-pain rule overrides time and intensity']), lift('tue', HALF)),
  day(bullets('Easy swim', ['100m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '4×100m relaxed freestyle', '100m easy cool-down', 'Total 800m']), lift('wed', HALF)),
  day(bullets('Easy run + optional easy bike', ['35 min easy run/walk', 'Optional 30 min easy bike, separate from run; skip it first if fatigue rises', 'First 8 min: running form warm-up R (included)']), lift('thu', HALF)),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '1×400m controlled freestyle', '300m easy freestyle', '100m easy cool-down', 'Total 1,100m']), lift('fri', `${HALF}; optional`)),
  day(bullets('Long run', ['50 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['80 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_19: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill A (exhale + low breath) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '7×100m controlled freestyle', '100m easy cool-down', 'Total 1,400m']), lift('mon', 'Optional today')),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '4×(5 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 52 min; then 15 min easy run/walk', 'Back-pain rule overrides time and intensity']), lift('tue')),
  day(bullets('Easy swim', ['200m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '6×100m relaxed freestyle', '100m easy cool-down', 'Total 1,100m']), lift('wed')),
  day(bullets('Easy run + optional easy bike', ['45 min easy run/walk', 'Optional 30 min easy bike, separate from run; skip it first if fatigue rises', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '2×400m controlled freestyle', '300m easy freestyle', '200m easy cool-down', 'Total 1,600m', 'Replace with a supported open-water session when available; similar duration, not extra volume']), lift('fri', 'Optional today')),
  day(bullets('Long run', ['70 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['120 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_20: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill B (relaxed recovery) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '7×100m controlled freestyle', '100m easy cool-down', 'Total 1,400m']), lift('mon', 'Optional today')),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '4×(5 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 52 min; then 20 min easy run/walk', 'Back-pain rule overrides time and intensity']), lift('tue')),
  day(bullets('Easy swim', ['200m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '7×100m relaxed freestyle', '100m easy cool-down', 'Total 1,200m']), lift('wed')),
  day(bullets('Easy run + optional easy bike', ['45 min easy run/walk', 'Optional 30 min easy bike, separate from run; skip it first if fatigue rises', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×50m: 25m skill A / 25m easy freestyle', '3×400m controlled freestyle', '200m easy cool-down', 'Total 1,700m', 'Replace with a supported open-water session when available; similar duration, not extra volume']), lift('fri', 'Optional today')),
  day(bullets('Long run', ['75 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['125 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_21: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill C (compact two-beat kick) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '7×100m controlled freestyle', '200m easy cool-down', 'Total 1,500m']), lift('mon', 'Optional today')),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '4×(5 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 52 min; then 20 min easy run/walk', 'Back-pain rule overrides time and intensity']), lift('tue')),
  day(bullets('Easy swim', ['200m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '7×100m relaxed freestyle', '100m easy cool-down', 'Total 1,200m']), lift('wed')),
  day(bullets('Easy run + optional easy bike', ['50 min easy run/walk', 'Optional 30 min easy bike, separate from run; skip it first if fatigue rises', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '1,400m continuous comfortable freestyle, only if prior long repeats were controlled', '200m easy cool-down', 'Total 1,800m', 'Replace with supported open water when available; practice race gear and sighting']), lift('fri', 'Optional today')),
  day(bullets('Long run', ['75 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['130 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_22: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill A (exhale + low breath) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '4×100m controlled freestyle', '100m easy cool-down', 'Total 1,100m']), lift('mon', `${HALF}; optional`)),
  day(bullets('Quality bike + easy brick', ['35 min easy bike; no intervals', 'Optional 10 min easy transition run if fresh', 'Back-pain rule overrides time and intensity']), lift('tue', HALF)),
  day(bullets('Easy swim', ['100m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '5×100m relaxed freestyle', '100m easy cool-down', 'Total 900m']), lift('wed', HALF)),
  day(bullets('Easy run + optional easy bike', ['35 min easy run/walk', 'Optional 30 min easy bike, separate from run; skip it first if fatigue rises', 'First 8 min: running form warm-up R (included)']), lift('thu', HALF)),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×400m controlled freestyle', '200m easy freestyle', '100m easy cool-down', 'Total 1,300m']), lift('fri', `${HALF}; optional`)),
  day(bullets('Long run', ['55 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['90 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_23: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill B (relaxed recovery) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '7×100m controlled freestyle', '200m easy cool-down', 'Total 1,500m']), lift('mon', 'Optional today')),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '4×(5 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 52 min; then 20 min easy run/walk', 'Back-pain rule overrides time and intensity']), lift('tue')),
  day(bullets('Easy swim', ['200m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '7×100m relaxed freestyle', '100m easy cool-down', 'Total 1,200m']), lift('wed')),
  day(bullets('Easy run + optional easy bike', ['50 min easy run/walk', 'Optional 30 min easy bike, separate from run; skip it first if fatigue rises', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '1,500m continuous comfortable freestyle, only if prior long repeats were controlled', '200m easy cool-down', 'Total 1,900m', 'Replace with supported open water when available; practice race gear and sighting']), lift('fri', 'Optional today')),
  day(bullets('Long run', ['80 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['135 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_24: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill C (compact two-beat kick) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '7×100m controlled freestyle', '200m easy cool-down', 'Total 1,500m']), lift('mon', 'Optional today')),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '4×(5 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 52 min; then 20 min easy run/walk', 'Back-pain rule overrides time and intensity']), lift('tue')),
  day(bullets('Easy swim', ['200m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '8×100m relaxed freestyle', '100m easy cool-down', 'Total 1,300m']), lift('wed')),
  day(bullets('Easy run + optional easy bike', ['50 min easy run/walk', 'Optional 30 min easy bike, separate from run; skip it first if fatigue rises', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '3×500m controlled freestyle', '100m easy freestyle', '200m easy cool-down', 'Total 2,000m', 'Replace with supported open water when available; practice race gear and sighting']), lift('fri', 'Optional today')),
  day(bullets('Long run', ['80 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['140 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_25: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill A (exhale + low breath) / 25m relaxed freestyle', '4×25m D: brief front scull, then easy freestyle', '2×50m pull buoy', '7×100m controlled freestyle', '100m easy cool-down', 'Total 1,400m']), lift('mon', 'Optional today')),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '4×(5 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 52 min; then 20 min easy run/walk', 'Back-pain rule overrides time and intensity']), lift('tue')),
  day(bullets('Easy swim', ['200m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '6×100m relaxed freestyle', '100m easy cool-down', 'Total 1,100m']), lift('wed')),
  day(bullets('Easy run + optional easy bike', ['45 min easy run/walk', 'Optional 30 min easy bike, separate from run; skip it first if fatigue rises', 'First 8 min: running form warm-up R (included)']), lift('thu')),
  day(bullets('Endurance swim', ['200m easy warm-up', '1,500m continuous comfortable freestyle, only if prior long repeats were controlled', '200m easy cool-down', 'Total 1,900m']), lift('fri', 'Optional today')),
  day(bullets('Long run', ['70 min easy run/walk', 'Practice familiar fuel if over 75-90 min', 'Every 10 min: brief relaxed posture/breath check']), REST),
  day(bullets('Long bike', ['120 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_26: DayPlan[] = [
  day(bullets('Technique swim', ['200m easy warm-up', '4×50m: 25m skill A (exhale + low breath) / 25m relaxed freestyle', '2×50m pull buoy', '5×100m controlled freestyle', '100m easy cool-down', 'Total 1,100m']), OPTIONAL_UPPER),
  day(bullets('Quality bike + easy brick', ['10 min easy bike', '4×(5 min steady RPE 5-6 + 3 min easy)', '10 min easy bike', 'Total bike 52 min; then 20 min easy run/walk', 'Back-pain rule overrides time and intensity']), OPTIONAL_UPPER),
  day(bullets('Easy swim', ['100m easy warm-up', '4×25m easy breathing practice (A); rest 20-40 sec', '2×50m: 25m B / 25m easy freestyle', '5×100m relaxed freestyle', '100m easy cool-down', 'Total 900m']), LIGHT_LEGS),
  day(bullets('Easy run + optional easy bike', ['35 min easy run/walk', 'Optional 30 min easy bike, separate from run; skip it first if fatigue rises', 'Back-pain rule overrides time and intensity']), REST),
  day(bullets('Endurance swim', ['200m easy warm-up', '2×400m controlled freestyle', '200m easy freestyle', '100m easy cool-down', 'Total 1,300m']), REST),
  day(bullets('Long run', ['50 min easy run/walk', 'Practice familiar fuel if over 75-90 min']), REST),
  day(bullets('Long bike', ['90 min easy bike', 'RPE 3-4/10; steady, comfortable effort', 'Back-pain rule overrides time and intensity']), REST),
]

const WEEK_27: DayPlan[] = [
  day(bullets('Technique swim', ['100m easy warm-up', '2×50m: 25m skill A (exhale + low breath) / 25m relaxed freestyle', '2×50m pull buoy', '2×100m controlled freestyle', '100m easy cool-down', 'Total 600m']), REST),
  day(bullets('Easy bike + short brick', ['20 min easy bike', '3×(1 min steady / 2 min easy)', '5 min easy bike', 'Total bike 34 min; optional 5 min easy jog']), REST),
  day(bullets('Easy swim', ['100m easy warm-up', '3×100m relaxed freestyle', '100m easy cool-down', 'Total 500m']), REST),
  day(bullets('Easy run', ['15 min easy', 'Optional 3×15 sec relaxed pickups with full walking recovery']), REST),
  day(bullets('Open-water familiarization', ['300m easy, supported, only if conditions and safety cover are suitable', 'Otherwise rest. No fitness test.']), REST),
  day(bullets('Rest / gear check', ['Check bike, helmet, goggles, nutrition and transitions', 'No catch-up workout']), REST),
  day(bullets('LAVAMAN: Sunday April 4', ['1,500m swim + 40km bike + 10km run', 'Calm swim, controlled bike, patient run', 'Follow the current athlete guide and conditions']), REST),
]

const WEEKS: DayPlan[][] = [
  WEEK_1, WEEK_2, WEEK_3, WEEK_4, WEEK_5, WEEK_6, WEEK_7, WEEK_8, WEEK_9, WEEK_10, WEEK_11, WEEK_12, WEEK_13,
  WEEK_14, WEEK_15, WEEK_16, WEEK_17, WEEK_18, WEEK_19, WEEK_20, WEEK_21, WEEK_22, WEEK_23, WEEK_24, WEEK_25, WEEK_26, WEEK_27,
]

// ── Building the records ─────────────────────────────────────────────────────

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function slots(weekNumber: number, plan: DayPlan) {
  return weekNumber <= LAST_STRENGTH_FIRST_WEEK
    ? { morning: plan.lift, evening: plan.endurance }
    : { morning: plan.endurance, evening: plan.lift }
}

/** One training-log row per day of the plan, in the shape the log already uses. */
export const TRAINING_PLAN: TrainingRecord[] = WEEKS.flatMap((days, weekIndex) =>
  days.map((plan, dayIndex) => {
    const date = dateKey(addDays(TRAINING_PLAN_START, weekIndex * 7 + dayIndex))
    const { morning, evening } = slots(weekIndex + 1, plan)
    return {
      training_id: `plan-${date}`,
      date,
      morning_workout: morning,
      evening_workout: evening,
      completed_morning: false,
      completed_evening: false,
    }
  }),
)

/**
 * The training log with the plan filled in for any date it has no row for.
 * A logged row, even an empty one, is what was pasted for that day, so it wins.
 */
export function mergeTrainingLog(log: TrainingRecord[], plan: TrainingRecord[] = TRAINING_PLAN): TrainingRecord[] {
  const logged = new Set(log.map((row) => toDateOnlyKey(row.date)))
  return [...plan.filter((row) => !logged.has(toDateOnlyKey(row.date))), ...log]
}
