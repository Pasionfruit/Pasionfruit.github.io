import { Camera } from 'lucide-react'
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { addDaysToKey } from '../data/todoist/dates'
import { blankCheckin, saveRow, type Checkin } from './client'
import type { ProgressData } from './useProgressData'
import { FoodReview } from './FoodReview'
import { estimateMeal, type FoodItem } from './food'
import { Review } from './ReviewPanel'
import { addSkinPhoto } from './skinPhotos'
import type { SkinPhoto } from './client'
import { PERIOD_START, importedDay, periodDay, todayLocal, upkeep } from './analytics'

type Draft = Omit<Checkin, 'updated_at'>

/** Sensible bounds, so a typo cannot land as 800 hours of sugar. */
const LIMITS: Partial<Record<keyof Draft, [number, number]>> = {
  acne_face: [0, 200], acne_back: [0, 200], sugar_g: [0, 1000], protein_g: [0, 1000],
  carbs_g: [0, 2000], min_content: [0, 1440], min_leisure: [0, 1440],
}

/** One line: the label, then 1–5. Tap a selected number again to clear it. */
function Rating({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="pg-rating" role="group" aria-label={label}>
      <span>{label}</span>
      <div>
        {['1', '2', '3', '4', '5'].map((n) => (
          <button key={n} type="button" className={value === n ? 'is-on' : ''} aria-pressed={value === n} onClick={() => onChange(value === n ? '' : n)}>
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

function Chip({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`pg-chip${on ? ' is-on' : ''}`} aria-pressed={on} onClick={onToggle}>
      {on ? '✓ ' : ''}{label}
    </button>
  )
}

function Num({ label, value, onChange, step = '1' }: { label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <label className="pg-field">
      <span>{label}</span>
      <input type="number" inputMode="decimal" min="0" step={step} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/** The age of an upkeep task, as a short phrase. */
function ago(days: number | null) {
  return days === null ? 'not logged' : days === 0 ? 'today' : `${days}d ago`
}

/**
 * One form for the whole day. Sleep and training are not typed: they come from the
 * Garmin and Hevy/Apple logs. Pick any past date to edit it.
 */
export function CheckinTab({ idToken, data, onSaved }: { idToken: string; data: ProgressData; onSaved: () => void }) {
  const [date, setDate] = useState(todayLocal)
  const saved = useMemo(() => data.logged.find((c) => c.date === date), [data.logged, date])
  const imported = useMemo(() => importedDay(date, data.wellness, data.activities), [date, data.wellness, data.activities])
  const chores = useMemo(() => upkeep(data.logged, date), [data.logged, date])

  const seed = useMemo<Draft>(() => ({ ...blankCheckin(date), ...(saved ?? {}), date }), [saved, date])
  const [draft, setDraft] = useState<Draft>(seed)
  const [seedKey, setSeedKey] = useState(`${date}|${saved?.updated_at ?? ''}`)
  const key = `${date}|${saved?.updated_at ?? ''}`
  if (key !== seedKey) {
    setSeedKey(key)
    setDraft(seed)
  }

  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const set = <K extends keyof Draft>(field: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [field]: value }))
    setStatus('idle')
  }
  const flip = (field: 'am_done' | 'pm_done' | 'mask' | 'towel' | 'sheets') => set(field, draft[field] === 'yes' ? '' : 'yes')

  async function submit(event: FormEvent) {
    event.preventDefault()
    for (const [field, [lo, hi]] of Object.entries(LIMITS) as [keyof Draft, [number, number]][]) {
      const v = draft[field]
      if (v !== '' && (!Number.isFinite(Number(v)) || Number(v) < lo || Number(v) > hi)) {
        setStatus('error')
        setMessage(`${field.replace(/_/g, ' ')} must be between ${lo} and ${hi}.`)
        return
      }
    }
    setStatus('saving')
    try {
      // Sleep and training are never stored from here; the logs are the source.
      await saveRow(idToken, 'progress_checkins', { ...draft, sleep_h: '', min_training: '', updated_at: new Date().toISOString() })
      setStatus('saved')
      setMessage('Saved.')
      onSaved()
    } catch (caught) {
      setStatus('error')
      setMessage(caught instanceof Error ? caught.message : 'Could not save.')
    }
  }

  const faceInput = useRef<HTMLInputElement>(null)
  const backInput = useRef<HTMLInputElement>(null)
  const mealInput = useRef<HTMLInputElement>(null)
  const [reviewing, setReviewing] = useState<{ photo: SkinPhoto; source: File } | null>(null)
  const [meal, setMeal] = useState<{ phase: 'scanning' | 'ready'; items: FoodItem[] } | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [uploading, setUploading] = useState(false)

  /** A skin photo straight from the camera: stored, then circled for review. */
  async function onSkinPhoto(angle: 'face' | 'back', event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setCameraError('')
    setMeal(null)
    setUploading(true)
    try {
      const photo = await addSkinPhoto(idToken, file, date, angle)
      setReviewing({ photo, source: file })
    } catch (caught) {
      setCameraError(caught instanceof Error ? caught.message : 'Could not save the photo.')
    } finally {
      setUploading(false)
    }
  }

  async function onMealPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setCameraError('')
    setReviewing(null)
    setMeal({ phase: 'scanning', items: [] })
    try {
      setMeal({ phase: 'ready', items: await estimateMeal(idToken, file) })
    } catch (caught) {
      setMeal(null)
      setCameraError(caught instanceof Error ? caught.message : 'Could not read the meal.')
    }
  }

  const addNumber = (current: string, extra: number) => String(Math.round((Number(current) || 0) + extra))

  const day = periodDay(date)
  return (
    <form className="pg-form" onSubmit={submit}>
      <div className="pg-daynav">
        <button type="button" className="secondary-action" onClick={() => setDate(addDaysToKey(date, -1))} aria-label="Previous day">‹</button>
        <div className="pg-daynav-mid">
          <input type="date" value={date} max={todayLocal()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Check-in date" />
          <span className="sheets-meta">
            {day && day <= 90 ? `Day ${day} of 90` : date < PERIOD_START ? `Starts ${PERIOD_START}` : `Day ${day}`}
            {saved ? ' · saved' : ''}
          </span>
        </div>
        <button type="button" className="secondary-action" onClick={() => setDate(addDaysToKey(date, 1))} disabled={date >= todayLocal()} aria-label="Next day">›</button>
      </div>

      <section className="pg-compact">
        <div className="pg-chips">
          <Chip label="Morning" on={draft.am_done === 'yes'} onToggle={() => flip('am_done')} />
          <Chip label="Night" on={draft.pm_done === 'yes'} onToggle={() => flip('pm_done')} />
          <Chip label="Mask" on={draft.mask === 'yes'} onToggle={() => flip('mask')} />
          <Chip label="Towel" on={draft.towel === 'yes'} onToggle={() => flip('towel')} />
          <Chip label="Sheets" on={draft.sheets === 'yes'} onToggle={() => flip('sheets')} />
        </div>
        <p className="sheets-meta">
          Masks this week {chores.masksThisWeek}/2 · towel {ago(chores.towelDaysAgo)} · sheets {ago(chores.sheetsDaysAgo)}
        </p>
        <div className="pg-camera" role="group" aria-label="Take a photo">
          <button type="button" className="pg-chip" disabled={uploading} onClick={() => faceInput.current?.click()}><Camera size={16} aria-hidden="true" /> Face</button>
          <button type="button" className="pg-chip" disabled={uploading} onClick={() => backInput.current?.click()}><Camera size={16} aria-hidden="true" /> Back</button>
          <button type="button" className="pg-chip" onClick={() => mealInput.current?.click()}><Camera size={16} aria-hidden="true" /> Meal</button>
          <input ref={faceInput} type="file" accept="image/*" capture="user" hidden onChange={(e) => void onSkinPhoto('face', e)} />
          <input ref={backInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onSkinPhoto('back', e)} />
          <input ref={mealInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onMealPhoto(e)} />
        </div>
        {uploading && <p className="sheets-meta" role="status">Saving photo…</p>}
        {cameraError && <p className="pg-error" role="alert">{cameraError}</p>}
        <Rating label="Energy" value={draft.energy} onChange={(v) => set('energy', v)} />
        <Rating label="Mood" value={draft.mood} onChange={(v) => set('mood', v)} />
        <Rating label="Stress" value={draft.stress} onChange={(v) => set('stress', v)} />
        <p className="sheets-meta">
          From your logs: sleep {imported.sleep_h ? `${imported.sleep_h} h` : '—'} · training {imported.min_training ? `${imported.min_training} min` : '—'}
        </p>
      </section>

      {reviewing && (
        <Review
          key={reviewing.photo.photo_id}
          idToken={idToken}
          photo={reviewing.photo}
          source={reviewing.source}
          data={data}
          onCounts={(angle, acne) => set(angle === 'back' ? 'acne_back' : 'acne_face', String(acne))}
          onDone={() => { setReviewing(null); onSaved() }}
        />
      )}
      {meal && meal.phase === 'scanning' && <p className="sheets-meta" role="status">Your PC is looking at the meal. This can take a minute.</p>}
      {meal && meal.phase === 'ready' && (
        <FoodReview
          items={meal.items}
          onChange={(items) => setMeal({ phase: 'ready', items })}
          onAdd={(t) => {
            setDraft((d) => ({ ...d, protein_g: addNumber(d.protein_g, t.protein_g), carbs_g: addNumber(d.carbs_g, t.carbs_g), sugar_g: addNumber(d.sugar_g, t.sugar_g) }))
            setStatus('idle')
            setMeal(null)
          }}
          onClose={() => setMeal(null)}
        />
      )}

      <details className="pg-details">
        <summary>More (acne, skin, food, time, notes)</summary>
        <div className="pg-more">
          <div className="pg-grid pg-two">
            <Num label="Acne · face" value={draft.acne_face} onChange={(v) => set('acne_face', v)} />
            <Num label="Acne · back" value={draft.acne_back} onChange={(v) => set('acne_back', v)} />
          </div>
          <Rating label="Redness" value={draft.redness} onChange={(v) => set('redness', v)} />
          <Rating label="Scars" value={draft.scar} onChange={(v) => set('scar', v)} />
          <label className="pg-field">
            <span>Products & treatments</span>
            <input type="text" value={draft.products} placeholder="e.g. adapalene, SPF 50" onChange={(e) => set('products', e.target.value)} />
          </label>
          <div className="pg-grid pg-two">
            <Num label="Added sugar (g)" value={draft.sugar_g} onChange={(v) => set('sugar_g', v)} />
            <Num label="Protein (g)" value={draft.protein_g} onChange={(v) => set('protein_g', v)} />
            <Num label="Carbs (g)" value={draft.carbs_g} onChange={(v) => set('carbs_g', v)} />
            <Num label="Content (min)" value={draft.min_content} onChange={(v) => set('min_content', v)} />
            <Num label="Leisure (min)" value={draft.min_leisure} onChange={(v) => set('min_leisure', v)} />
          </div>
          <div className="pg-chips">
            <Chip label="Dairy / whey" on={draft.dairy === 'yes'} onToggle={() => set('dairy', draft.dairy === 'yes' ? 'no' : draft.dairy === 'no' ? '' : 'yes')} />
            {draft.dairy === 'no' && <span className="sheets-meta">no dairy today</span>}
          </div>
          <label className="pg-field">
            <span>Notes</span>
            <textarea rows={2} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>
      </details>

      <div className="pg-actions pg-sticky">
        <button type="submit" className="primary-action" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : saved ? 'Update day' : 'Save day'}
        </button>
        {message && status !== 'idle' && <span className={status === 'error' ? 'pg-error' : 'sheets-meta'} role="status">{message}</span>}
      </div>
    </form>
  )
}
