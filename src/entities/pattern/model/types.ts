/** Domain model for patterns (§5). Framework-free, plain data. */

export type Voice =
  | 'kick'
  | 'snare'
  | 'sidestick'
  | 'hihat'
  | 'openhat'
  | 'ride'
  | 'shaker'
  | 'cymbalA'
  | 'cymbalB'
  | 'cymbalC'
  | 'tomLow'
  | 'tomMid'
  | 'tomHigh'

/** "R" = lead hand (circle token), "L" = alternate hand (diamond token). */
export type Hand = 'R' | 'L'

export interface Hit {
  /** 0-based bar. */
  bar: number
  /** 0-based step within the bar. */
  step: number
  voice: Voice
  /** Defaults to "R". */
  hand?: Hand
  /** Render larger, play louder. */
  accent?: boolean
  /** Render smaller and hollow, play softer. */
  ghost?: boolean
}

export interface DrillConfig {
  /** BPM at which stars are earned. */
  targetBpm: number
  /** Accuracy % for 1★ / 2★ / 3★. */
  starAccuracy: [number, number, number]
  /** Require the exact pad, not just the right voice (§4.2). */
  strictHands?: boolean
  /** Coaching tip shown before the drill. */
  notes?: string
}

export interface Pattern {
  id: string
  title: string
  /** Curriculum tier. */
  level: number
  timeSig: [number, number]
  /** Steps per bar in 4/4: 8 = eighths, 16 = sixteenths. */
  subdivision: 8 | 16
  bars: number
  bpmDefault: number
  bpmRange: [number, number]
  /**
   * Off-beat delay, 0 straight to 1 full triplet feel (§7.3). Omitted means
   * straight — the feel is part of the groove, so it travels with it.
   */
  swing?: number
  /** One label per step of a bar, e.g. ["1","e","&","a", …]. */
  countLabels: string[]
  /** Score-view row order, top → bottom. */
  lanes: Voice[]
  hits: Hit[]
  drill?: DrillConfig
}

export const VOICES: readonly Voice[] = [
  'kick',
  'snare',
  'sidestick',
  'hihat',
  'openhat',
  'ride',
  'shaker',
  'cymbalA',
  'cymbalB',
  'cymbalC',
  'tomLow',
  'tomMid',
  'tomHigh',
]

export function isVoice(value: unknown): value is Voice {
  return typeof value === 'string' && (VOICES as readonly string[]).includes(value)
}
