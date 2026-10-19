/* Inky's meow, synthesised in the browser so the page ships no sound file. Browsers
   only allow sound after a click, so the first meow comes from picking the laser. */

let context: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (context) return context
  const Constructor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Constructor) return null
  context = new Constructor()
  return context
}

/** A short rising-then-falling "mew". Silently does nothing if audio is blocked or missing. */
export function meowOnce() {
  try {
    const ctx = audioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()

    const now = ctx.currentTime
    const oscillator = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()

    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(520, now)
    oscillator.frequency.linearRampToValueAtTime(880, now + 0.25)
    oscillator.frequency.linearRampToValueAtTime(620, now + 0.6)

    filter.type = 'lowpass'
    filter.frequency.value = 1800

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7)

    oscillator.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.75)
  } catch {
    // No sound is fine; the mouth still opens.
  }
}
