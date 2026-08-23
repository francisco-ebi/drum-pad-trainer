/** XP per take, scaled by the score (§11.2). */
export const XP_PER_100_SCORE = 1
/** A flat award for showing up, so a rough take still moves the bar. */
export const XP_PER_TAKE = 10
/** Bonus per star earned. */
export const XP_PER_STAR = 25

export function xpForTake({ score, stars }: { score: number; stars: number }): number {
  return XP_PER_TAKE + Math.floor((score / 100) * XP_PER_100_SCORE) + stars * XP_PER_STAR
}

/**
 * Level curve: purely cosmetic (§11.2), and deliberately gentle — levels are a
 * pat on the back, not a gate.
 *
 * Each level costs 100 XP more than the last, so level n arrives at
 * 50·n·(n−1) XP total.
 */
export function levelForXp(xp: number): number {
  if (xp <= 0) return 1
  return Math.floor((1 + Math.sqrt(1 + xp / 12.5)) / 2)
}

export function xpForLevel(level: number): number {
  return 50 * level * (level - 1)
}

export interface LevelProgress {
  level: number
  /** XP earned inside the current level. */
  into: number
  /** XP the current level spans. */
  span: number
  /** 0–1 through the current level. */
  fraction: number
}

export function levelProgress(xp: number): LevelProgress {
  const level = levelForXp(xp)
  const floor = xpForLevel(level)
  const ceiling = xpForLevel(level + 1)
  const span = Math.max(1, ceiling - floor)
  const into = Math.max(0, xp - floor)
  return { level, into, span, fraction: Math.min(1, into / span) }
}
