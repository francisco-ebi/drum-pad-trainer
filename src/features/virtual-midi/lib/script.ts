import type { PadStrike } from '@/entities/device'
import type { ExpectedHit } from '@/entities/take'
import type { PadIndex } from '@/shared/config'

/** One scripted strike, stamped on the audio clock. */
export interface ScriptedStrike {
  pad: PadIndex
  voice: PadStrike['voice']
  velocity: number
  /** Audio-clock time the strike claims to have happened at. */
  time: number
}

export interface PlayStyle {
  /** Constant device latency to simulate, in ms. */
  offsetMs: number
  /** Random spread either side of the offset, in ms. */
  jitterMs: number
  /** Fraction of notes to drop entirely, 0–1. */
  missRate: number
  /** Fraction of notes to play on the wrong pad, 0–1. */
  wrongPadRate: number
  /** Fraction of notes after which to add a stray strike, 0–1. */
  extraRate: number
}

export const PERFECT_PLAYER: PlayStyle = {
  offsetMs: 0,
  jitterMs: 0,
  missRate: 0,
  wrongPadRate: 0,
  extraRate: 0,
}

export const SLOPPY_PLAYER: PlayStyle = {
  offsetMs: 18,
  jitterMs: 45,
  missRate: 0.08,
  wrongPadRate: 0.05,
  extraRate: 0.04,
}

/** Deterministic PRNG, so a "sloppy" run can be reproduced from its seed. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) % 100000) / 100000
  }
}

/**
 * Turn an expected timeline into a performance (§13.3).
 *
 * The point of the tool is that the *stamp* is exact even when delivery is
 * not: a scripted +20 ms take really is +20 ms, so the acceptance criterion is
 * checking judging, not the accuracy of a test harness's timers.
 */
export function scriptTake(
  expected: readonly ExpectedHit[],
  style: PlayStyle,
  random: () => number = Math.random,
  wrongPad: PadIndex = { row: 1, col: 1 },
): ScriptedStrike[] {
  const strikes: ScriptedStrike[] = []

  for (const hit of expected) {
    if (style.missRate > 0 && random() < style.missRate) continue

    const jitter = style.jitterMs === 0 ? 0 : (random() * 2 - 1) * style.jitterMs
    const time = hit.time + (style.offsetMs + jitter) / 1000
    const playWrong = style.wrongPadRate > 0 && random() < style.wrongPadRate

    strikes.push({
      pad: playWrong ? wrongPad : hit.pad,
      voice: playWrong ? undefined : hit.voice,
      velocity: 100,
      time,
    })

    if (style.extraRate > 0 && random() < style.extraRate) {
      strikes.push({ pad: hit.pad, voice: hit.voice, velocity: 70, time: time + 0.11 })
    }
  }

  return strikes.sort((a, b) => a.time - b.time)
}
