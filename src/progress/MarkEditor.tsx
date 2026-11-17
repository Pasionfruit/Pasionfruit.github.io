import { useState } from 'react'
import type { SkinMark } from './client'

const COLORS = { acne: '#ef4444', scar: '#8b5cf6' } as const
const ZOOMS = [1, 2, 3, 4] as const

/**
 * Circles over a photo. With `onChange` they can be selected, retyped, removed, and new ones added by tapping.
 *
 * One handler on the frame does all the tapping: a tap on an existing ring selects it, any other tap adds a
 * circle and selects nothing, so the next tap adds the next spot. The circles themselves never take taps,
 * which keeps a crowd of spots from swallowing each other's taps.
 */
export function MarkedImage({ src, alt, marks, onChange }: { src: string; alt: string; marks: SkinMark[]; onChange?: (marks: SkinMark[]) => void }) {
  const [ratio, setRatio] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const [addKind, setAddKind] = useState<SkinMark['kind']>('acne')
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1)
  const editable = Boolean(onChange)

  function tap(event: React.MouseEvent<HTMLDivElement>) {
    if (!onChange) return
    const box = event.currentTarget.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return
    const x = (event.clientX - box.left) / box.width
    const y = ((event.clientY - box.top) / box.height) * ratio

    // On a ring (within a few pixels of its edge): select it instead of adding another.
    const slop = 3 / box.width
    const hit = marks.findIndex((m) => Math.abs(Math.hypot(m.x - x, m.y - y) - m.r) <= slop)
    if (hit >= 0) {
      setSelected(hit)
      return
    }
    // Smaller circles when zoomed in, so a crowd of spots can each be tapped.
    onChange([...marks, { kind: addKind, x, y, r: Math.max(0.006, 0.016 / zoom) }])
    setSelected(null)
  }

  const chosen = selected !== null ? marks[selected] : undefined

  return (
    <div className="pg-marked">
      {editable && (
        <div className="pg-actions">
          <span className="sheets-meta">Zoom</span>
          <div className="pg-subtabs" role="group" aria-label="Zoom">
            {ZOOMS.map((z) => (
              <button key={z} type="button" className={zoom === z ? 'is-on' : ''} aria-pressed={zoom === z} onClick={() => setZoom(z)}>{z}×</button>
            ))}
          </div>
          <button type="button" className="secondary-action" disabled={marks.length === 0} onClick={() => { onChange?.(marks.slice(0, -1)); setSelected(null) }}>Undo last</button>
        </div>
      )}
      <div className="pg-marked-scroll">
        <div className="pg-marked-frame" style={{ width: `${zoom * 100}%`, cursor: editable ? 'crosshair' : 'default', touchAction: 'manipulation' }} onClick={tap}>
          <img src={src} alt={alt} onLoad={(e) => setRatio(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth || 1)} />
          <svg viewBox={`0 0 1 ${ratio}`} className="pg-marks" aria-hidden="true">
            {marks.map((m, i) => (
              <g key={i}>
                <circle cx={m.x} cy={m.y} r={m.r} fill="none" stroke={COLORS[m.kind]} strokeWidth={selected === i ? 0.005 : 0.002} />
                {(marks.length <= 20 || selected === i) && (
                  <text x={m.x + m.r + 0.004} y={m.y - m.r} fontSize="0.022" fill={COLORS[m.kind]} fontWeight="700">{m.kind === 'acne' ? 'A' : 'S'}{i + 1}</text>
                )}
              </g>
            ))}
          </svg>
        </div>
      </div>
      <p className="pg-legend">
        <span><i style={{ background: COLORS.acne }} />A = acne {marks.filter((m) => m.kind === 'acne').length}</span>
        <span><i style={{ background: COLORS.scar }} />S = scar {marks.filter((m) => m.kind === 'scar').length}</span>
      </p>
      {editable && onChange && (
        <div className="pg-actions">
          <span className="sheets-meta">Tap the photo to add a missed one as</span>
          <div className="pg-subtabs" role="group" aria-label="Add as">
            {(['acne', 'scar'] as const).map((k) => (
              <button key={k} type="button" className={addKind === k ? 'is-on' : ''} aria-pressed={addKind === k} onClick={() => setAddKind(k)}>{k}</button>
            ))}
          </div>
          {chosen && selected !== null && (
            <>
              <span className="sheets-meta">Selected {chosen.kind === 'acne' ? 'A' : 'S'}{selected + 1}:</span>
              <button type="button" className="secondary-action" onClick={() => onChange(marks.map((m, i) => (i === selected ? { ...m, kind: m.kind === 'acne' ? 'scar' : 'acne' } : m)))}>
                Make {chosen.kind === 'acne' ? 'scar' : 'acne'}
              </button>
              <button type="button" className="secondary-action" onClick={() => onChange(marks.map((m, i) => (i === selected ? { ...m, r: m.r * 1.25 } : m)))} aria-label="Bigger circle">＋</button>
              <button type="button" className="secondary-action" onClick={() => onChange(marks.map((m, i) => (i === selected ? { ...m, r: Math.max(0.006, m.r * 0.8) } : m)))} aria-label="Smaller circle">－</button>
              <button type="button" className="secondary-action" onClick={() => { onChange(marks.filter((_, i) => i !== selected)); setSelected(null) }}>Remove</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
