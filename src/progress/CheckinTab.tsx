import { useMemo, useState, type FormEvent } from 'react'
import { addDaysToKey } from '../data/todoist/dates'
import { saveRow, type Checkin } from './client'
import type { ProgressData } from './useProgressData'
import { PERIOD_START, periodDay, todayLocal, trainingMinutesOn } from './analytics'

type Draft = Omit<Checkin, 'updated_at'>

const BLANK: Omit<Draft, 'date'> = {
  am_done: '', pm_done: '', acne_face: '', acne_back: '', redness: '', scar: '', products: '',
  sleep_h: '', energy: '', mood: '', stress: '', sugar_g: '', protein_g: '', carbs_g: '', dairy: '',
  min_training: '', min_content: '', min_leisure: '', notes: '',
}

const SCALE = ['1', '2', '3', '4', '5']

/** Sensible bounds, so a typo cannot land as 800 hours of sleep. */
const LIMITS: Partial<Record<keyof Draft, [number, number]>> = {
  acne_face: [0, 200], acne_back: [0, 200], sleep_h: [0, 24], sugar_g: [0, 1000], protein_g: [0, 1000],
  carbs_g: [0, 2000], min_training: [0, 1440], min_content: [0, 1440], min_leisure: [0, 1440],
}

function Scale({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="pg-field pg-scale">
      <legend>{label}</legend>
      <div className="pg-scale-buttons">
        {SCALE.map((n) => (
          <button key={n} type="button" className={value === n ? 'is-on' : ''} aria-pressed={value === n} onClick={() => onChange(value === n ? '' : n)}>
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Num({ label, value, onChange, hint, step = '1' }: { label: string; value: string; onChange: (v: string) => void; hint?: string; step?: string }) {
  return (
    <label className="pg-field">
      <span>{label}</span>
      <input type="number" inputMode="decimal" min="0" step={step} value={value} placeholder={hint} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/**
 * One form for the whole day, any field skippable. Pick any past date to edit it.
 * Sleep and training time are pre-filled from the watch when nothing is saved yet.
 */
export function CheckinTab({ idToken, data, onSaved }: { idToken: string; data: ProgressData; onSaved: () => void }) {
  const [date, setDate] = useState(todayLocal)
  const saved = useMemo(() => data.checkins.find((c) => c.date === date), [data.checkins, date])

  const imported = useMemo(() => {
    const watch = data.wellness.find((w) => w.date.slice(0, 10) === date)
    const minutes = trainingMinutesOn(data.activities, date)
    return {
      sleep_h: watch?.sleep_duration_h ? String(Math.round(Number(watch.sleep_duration_h) * 10) / 10) : '',
      min_training: minutes > 0 ? String(minutes) : '',
    }
  }, [data.wellness, data.activities, date])

  // Reset the draft whenever the day (or its saved row) changes.
  const seed = useMemo<Draft>(
    () => ({ ...BLANK, ...imported, ...(saved ?? {}), date }),
    [saved, imported, date],
  )
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
      await saveRow(idToken, 'progress_checkins', { ...draft, updated_at: new Date().toISOString() })
      setStatus('saved')
      setMessage('Saved.')
      onSaved()
    } catch (caught) {
      setStatus('error')
      setMessage(caught instanceof Error ? caught.message : 'Could not save.')
    }
  }

  const day = periodDay(date)
  return (
    <form className="pg-form" onSubmit={submit}>
      <div className="pg-form-top">
        <div className="pg-daynav">
          <button type="button" className="secondary-action" onClick={() => setDate(addDaysToKey(date, -1))} aria-label="Previous day">‹</button>
          <input type="date" value={date} max={todayLocal()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Check-in date" />
          <button type="button" className="secondary-action" onClick={() => setDate(addDaysToKey(date, 1))} disabled={date >= todayLocal()} aria-label="Next day">›</button>
        </div>
        <p className="sheets-meta">
          {day && day <= 90 ? `Day ${day} of 90` : date < PERIOD_START ? `Starts ${PERIOD_START}` : `Day ${day}`}
          {saved ? ' · editing a saved day' : ' · new day'}
        </p>
      </div>

      <section>
        <h4>Skin</h4>
        <div className="pg-grid">
          <label className="pg-check"><input type="checkbox" checked={draft.am_done === 'yes'} onChange={(e) => set('am_done', e.target.checked ? 'yes' : '')} /> AM routine</label>
          <label className="pg-check"><input type="checkbox" checked={draft.pm_done === 'yes'} onChange={(e) => set('pm_done', e.target.checked ? 'yes' : '')} /> PM routine</label>
          <Num label="Active acne · face" value={draft.acne_face} onChange={(v) => set('acne_face', v)} />
          <Num label="Active acne · back" value={draft.acne_back} onChange={(v) => set('acne_back', v)} />
          <Scale label="Redness (1–5)" value={draft.redness} onChange={(v) => set('redness', v)} />
          <Scale label="Scar texture (1–5)" value={draft.scar} onChange={(v) => set('scar', v)} />
        </div>
        <label className="pg-field">
          <span>Products & treatments used</span>
          <input type="text" value={draft.products} placeholder="e.g. adapalene, SPF 50" onChange={(e) => set('products', e.target.value)} />
        </label>
      </section>

      <section>
        <h4>Body</h4>
        <div className="pg-grid">
          <Num label={imported.sleep_h && !saved ? 'Sleep (h) · from watch' : 'Sleep (h)'} value={draft.sleep_h} step="0.1" onChange={(v) => set('sleep_h', v)} />
          <Scale label="Energy (1–5)" value={draft.energy} onChange={(v) => set('energy', v)} />
          <Scale label="Mood (1–5)" value={draft.mood} onChange={(v) => set('mood', v)} />
          <Scale label="Stress (1–5)" value={draft.stress} onChange={(v) => set('stress', v)} />
        </div>
      </section>

      <section>
        <h4>Nutrition</h4>
        <div className="pg-grid">
          <Num label="Added sugar (g)" value={draft.sugar_g} onChange={(v) => set('sugar_g', v)} />
          <Num label="Protein (g)" value={draft.protein_g} onChange={(v) => set('protein_g', v)} />
          <Num label="Carbs (g)" value={draft.carbs_g} onChange={(v) => set('carbs_g', v)} />
          <fieldset className="pg-field pg-scale">
            <legend>Dairy / whey</legend>
            <div className="pg-scale-buttons">
              {['yes', 'no'].map((v) => (
                <button key={v} type="button" className={draft.dairy === v ? 'is-on' : ''} aria-pressed={draft.dairy === v} onClick={() => set('dairy', draft.dairy === v ? '' : v)}>
                  {v}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <section>
        <h4>Where the time went (minutes)</h4>
        <div className="pg-grid">
          <Num label={imported.min_training && !saved ? 'Training · from watch' : 'Training'} value={draft.min_training} onChange={(v) => set('min_training', v)} />
          <Num label="Content" value={draft.min_content} onChange={(v) => set('min_content', v)} />
          <Num label="Leisure" value={draft.min_leisure} onChange={(v) => set('min_leisure', v)} />
        </div>
      </section>

      <label className="pg-field">
        <span>Notes</span>
        <textarea rows={2} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>

      <div className="pg-actions">
        <button type="submit" className="primary-action" disabled={status === 'saving'}>
          {status === 'saving' ? 'Saving…' : saved ? 'Update day' : 'Save day'}
        </button>
        {message && status !== 'idle' && <span className={status === 'error' ? 'pg-error' : 'sheets-meta'} role="status">{message}</span>}
      </div>
    </form>
  )
}
