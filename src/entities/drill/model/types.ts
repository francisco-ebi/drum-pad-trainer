import type { Voice } from '@/entities/pattern/@x/drill'

export type TrackId = 'foundations' | 'sixteenths' | 'colors' | 'fills' | 'tempo'

export interface Track {
  id: TrackId
  /** 1-based position in the curriculum (§11.1). */
  index: number
  title: string
  summary: string
}

/**
 * A drill is a pattern plus fixed settings and pass criteria (§9.3).
 *
 * It is separate from the pattern because Track 5 replays earlier patterns at
 * escalating tempos (§11.1) — the same notes, a different bar to clear.
 */
export interface Drill {
  id: string
  trackId: TrackId
  patternId: string
  /** Position within the track. */
  order: number
  title: string
  /** BPM at which stars are earned (§11.1). */
  targetBpm: number
  /** Accuracy % for 1★ / 2★ / 3★. */
  starAccuracy: [number, number, number]
  /** Require the exact pad, not merely the right voice (§4.2). */
  strictHands: boolean
  /** Loops in one assessed take (§9.3). */
  loops: number
  /**
   * Lane preset to fix for this drill, by id. Plain data: the practice feature
   * decides what a preset id means, so the curriculum does not depend on it.
   */
  lanePresetId?: string
  /** Voices this drill is teaching, for the library card. */
  focus?: Voice[]
  notes?: string
}

/** Stars are 0–3; 0 means "not earned yet", not "failed". */
export type Stars = 0 | 1 | 2 | 3
