import { useState } from 'react'
import type { SkinMark } from './client'

const COLORS = { acne: '#ef4444', scar: '#8b5cf6' } as const

/** Circles over a photo. With `onChange` they can be selected, retyped, removed, and new ones added by tapping. */
export function MarkedImage({ src, alt, marks, onChange }: { src: string; alt: string; marks: SkinMark[]; onChange?: (marks: SkinMark[]) => void }) {
  const [ratio, setRatio] = useState(1)
  const [selected, setSelected] = useState<number | null>(null)
  const [addKind, setAddKind] = useState<SkinMark['kind']>('acne')
  const editable = Boolean(onChange)

  function addAt(event: React.MouseEvent<SVGSVGElement>) {
    if (!onChange) return
    const box = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width
    const y = ((event.clientY - box.top) / box.height) * ratio
    onChange([...marks, { kind: addKind, x, y, r: 0.018 }])
    setSelected(marks.length)
  }

  const chosen = selected !== null ? marks[selected] : undefined

  return (
    <div className="pg-marked">
      <div className="pg-marked-frame">
        <img src={src} alt={alt} onLoad={(e) => setRatio(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth || 1)} />
        <svg viewBox={`0 0 1 ${ratio}`} className="pg-marks" onClick={addAt} style={{ cursor: editable ? 'crosshair' : 'default' }} aria-hidden={!editable}>
          {marks.map((m, i) => (
            <g key={i} onClick={(e) => { if (editable) { e.stopPropagation(); setSelected(i) } }}>
              <circle cx={m.x} cy={m.y} r={m.r} fill="none" stroke={COLORS[m.kind]} strokeWidth={selected === i ? 0.007 : 0.0035} />
              <text x={m.x + m.r + 0.004} y={m.y - m.r} fontSize="0.022" fill={COLORS[m.kind]} fontWeight="700">{m.kind === 'acne' ? 'A' : 'S'}{i + 1}</text>
            </g>
          ))}
        </svg>
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
              <button type="button" className="secondary-action" onClick={() => onChange(marks.map((m, i) => (i === selected ? { ...m, r: Math.max(0.008, m.r * 0.8) } : m)))} aria-label="Smaller circle">－</button>
              <button type="button" className="secondary-action" onClick={() => { onChange(marks.filter((_, i) => i !== selected)); setSelected(null) }}>Remove</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
