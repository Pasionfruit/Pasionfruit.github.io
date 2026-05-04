// Module-level mutable state — written by Bike, read by FollowCamera.
// Using a plain object (not React state) to avoid re-renders every frame.
export const bikeState = {
  position: { x: 0, y: 0, z: 0 },
  angle: 0,   // current heading in radians
  speed: 0,
}