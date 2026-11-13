// Small synthesized sound effects for the wheel (no audio files to load).
const MUTE_KEY = 'challenge-wheel-muted'

let context: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  context ??= new Ctor()
  // Browsers start the context suspended until a user gesture; spinning is one.
  if (context.state === 'suspended') void context.resume()
  return context
}

export function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // Remembering the choice is a convenience only.
  }
}

function blip(frequency: number, start: number, length: number, volume: number, type: OscillatorType) {
  const ctx = audio()
  if (!ctx) return
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  const at = ctx.currentTime + start
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, at)
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(at)
  oscillator.stop(at + length + 0.02)
}

/** The peg clicking past the pointer. */
export function playTick() {
  blip(900 + Math.random() * 120, 0, 0.04, 0.12, 'square')
}

/** A short rising run for the winner. */
export function playWin() {
  ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => blip(frequency, index * 0.11, 0.35, 0.18, 'triangle'))
}
