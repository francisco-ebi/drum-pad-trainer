/**
 * Swing: the off-beats of each pair land late.
 *
 * `amount` is 0 for dead straight through 1 for a full triplet feel, where the
 * off-beat sits two-thirds of the way through its pair instead of half way.
 * Lo-fi and shuffle grooves live in between.
 *
 * The maths is a monotonic, piecewise-linear warp of step position, so it is
 * exactly invertible — which matters, because the playhead has to turn a clock
 * reading back into a position every frame.
 */
export const MAX_SWING = 1

export function clampSwing(amount: number): number {
  if (!Number.isFinite(amount)) return 0
  return Math.min(MAX_SWING, Math.max(0, amount))
}

/** How far the off-beat is pushed, as a fraction of one step. */
export function swingShift(amount: number): number {
  return clampSwing(amount) / 3
}

/**
 * Step position -> swung step position.
 *
 * Whole pairs keep their place — `warp(2k) === 2k` — so a swung bar still ends
 * exactly where a straight one would, and only the notes inside it move.
 * Positions before zero are left alone: the count-in is a straight click.
 */
export function swingWarp(position: number, amount: number): number {
  const shift = swingShift(amount)
  if (shift === 0 || position <= 0) return position

  const pair = Math.floor(position / 2)
  const within = position - pair * 2
  if (within <= 1) return pair * 2 + within * (1 + shift)
  return pair * 2 + 1 + shift + (within - 1) * (1 - shift)
}

/** The exact inverse of {@link swingWarp}. */
export function swingUnwarp(warped: number, amount: number): number {
  const shift = swingShift(amount)
  if (shift === 0 || warped <= 0) return warped

  // warp leaves even boundaries alone, so a position sits in the same pair.
  const pair = Math.floor(warped / 2)
  const within = warped - pair * 2
  const boundary = 1 + shift
  if (within <= boundary) return pair * 2 + within / (1 + shift)
  return pair * 2 + 1 + (within - boundary) / (1 - shift)
}
