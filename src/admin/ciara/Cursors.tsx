/* The three pointers for the WW+TG page, and the switch that picks one. Each pointer
   is tied to a cat whose eyes follow it: a feather for Midnight, the red laser dot
   for Inky, and a fish for Pirouette. */

import type { ReactElement } from 'react'

export type CursorKind = 'feather' | 'laser' | 'fish'

const CURSORS: { id: CursorKind; label: string }[] = [
  { id: 'feather', label: 'Feather' },
  { id: 'laser', label: 'Laser' },
  { id: 'fish', label: 'Fish' },
]

const INK = '#3b2a3f'

function FeatherIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 3 C 10 4, 18 8, 22 14 C 24 18, 25 21, 27 27 C 19 26, 12 22, 8 16 C 5 11, 3 7, 3 3 Z" fill="#ffd1e6" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3 3 L 27 27" stroke={INK} strokeWidth="1.2" />
    </svg>
  )
}

function FishIcon() {
  return (
    <svg width="22" height="14" viewBox="0 0 36 22" aria-hidden="true">
      <path d="M30 11 L 36 4 L 36 18 Z" fill="#8fd8ff" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4 11 C 10 2, 24 2, 30 11 C 24 20, 10 20, 4 11 Z" fill="#8fd8ff" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="11" cy="9" r="1.8" fill={INK} />
    </svg>
  )
}

function LaserIcon() {
  return <span className="ciara-switch-laser" aria-hidden="true" />
}

const ICONS: Record<CursorKind, () => ReactElement> = {
  feather: FeatherIcon,
  laser: LaserIcon,
  fish: FishIcon,
}

/** A small segmented control in the top right: which pointer is in use. */
export function CursorSwitch({ value, onChange }: { value: CursorKind; onChange: (kind: CursorKind) => void }) {
  return (
    <div className="ciara-cursor-switch" role="group" aria-label="Pointer">
      {CURSORS.map(({ id, label }) => {
        const Icon = ICONS[id]
        return (
          <button
            key={id}
            type="button"
            className="ciara-switch-option"
            aria-pressed={value === id}
            onClick={() => onChange(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** The pointer itself, drawn at the pointer position. Its tip (or centre) sits on the pointer. */
export function CursorGlyph({ kind, x, y }: { kind: CursorKind; x: number; y: number }) {
  if (kind === 'laser') {
    return <span className="ciara-cursor-dot" style={{ left: x, top: y }} aria-hidden="true" />
  }
  // The feather's tip is its top left corner; the fish is centred on the pointer.
  const style =
    kind === 'feather'
      ? { left: x - 3, top: y - 3 }
      : { left: x, top: y, transform: 'translate(-50%, -50%)' }
  return (
    <span className={`ciara-cursor-glyph ciara-cursor-${kind}`} style={style} aria-hidden="true">
      {kind === 'feather' ? <FeatherGlyph /> : <FishGlyph />}
    </span>
  )
}

function FeatherGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 3 C 10 4, 18 8, 22 14 C 24 18, 25 21, 27 27 C 19 26, 12 22, 8 16 C 5 11, 3 7, 3 3 Z" fill="#ffd1e6" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3 3 L 27 27" stroke={INK} strokeWidth="1.2" />
    </svg>
  )
}

function FishGlyph() {
  return (
    <svg width="40" height="26" viewBox="0 0 36 22" aria-hidden="true">
      <path d="M30 11 L 36 4 L 36 18 Z" fill="#8fd8ff" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4 11 C 10 2, 24 2, 30 11 C 24 20, 10 20, 4 11 Z" fill="#8fd8ff" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="11" cy="9" r="1.8" fill={INK} />
    </svg>
  )
}
