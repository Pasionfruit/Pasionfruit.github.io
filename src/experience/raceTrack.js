export const RACE_TRACK_BASE_RADIUS = 36.8
export const RACE_TRACK_WIDTH = 7.2
export const RACE_TRACK_WOBBLE = 1.35
export const RACE_TRACK_PETALS = 5
export const RACE_START_ANGLE = -Math.PI / 2

export function normalizeAngle(angle) {
  const twoPi = Math.PI * 2
  let a = angle % twoPi
  if (a < 0) a += twoPi
  return a
}

export function angularDistance(a, b) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b))
  return Math.min(diff, Math.PI * 2 - diff)
}

export function raceTrackRadiusAt(angle) {
  return (
    RACE_TRACK_BASE_RADIUS +
    RACE_TRACK_WOBBLE * Math.sin(RACE_TRACK_PETALS * angle + 0.35) -
    1.15 * Math.cos(4 * angle) +
    0.45 * Math.sin(2 * angle - 0.6)
  )
}

export function raceTrackPointAt(angle, radiusOffset = 0) {
  const radius = raceTrackRadiusAt(angle) + radiusOffset
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius]
}

export function raceTrackDistanceToCenterline(x, z) {
  const angle = Math.atan2(z, x)
  const radius = Math.hypot(x, z)
  return radius - raceTrackRadiusAt(angle)
}

export function isOnRaceTrackBand(x, z, margin = 0) {
  return Math.abs(raceTrackDistanceToCenterline(x, z)) <= RACE_TRACK_WIDTH / 2 + margin
}
