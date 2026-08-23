/**
 * Latency calibration statistics (§8.3).
 *
 * The user plays along with 16 quarter-note clicks; each hit's offset is
 * `hit time − nearest click time`. The device offset is the **median** of hits
 * 5–16 — the median because a single flubbed hit must not drag the correction,
 * and hits 1–4 because it takes a few beats to lock onto a click.
 */
export const CALIBRATION = {
  /** Clicks played during a calibration run. */
  clicks: 16,
  /** Hits before this 1-based index are discarded as warm-up. */
  firstScoredHit: 5,
  /** Above this spread the run is too inconsistent to store (§8.3). */
  maxIqrMs: 60,
  /** Offsets beyond this are a mis-hit, not latency. */
  maxPlausibleMs: 250,
} as const

export interface CalibrationResult {
  /** The correction to apply to every judged hit, in milliseconds. */
  offsetMs: number
  /** Spread of the scored hits; the sanity check (§8.3). */
  iqrMs: number
  /** How many hits were actually used. */
  sampleCount: number
  /** False when the spread is too wide to trust — offer a retry, store nothing. */
  usable: boolean
}

/** Median of a numeric list. Returns 0 for an empty list. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

/** Interquartile range, using the halves either side of the median. */
export function interquartileRange(values: readonly number[]): number {
  if (values.length < 4) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const lower = sorted.slice(0, mid)
  const upper = sorted.slice(sorted.length % 2 === 1 ? mid + 1 : mid)
  return median(upper) - median(lower)
}

/** Signed offset of each hit from the click it belongs to. */
export function offsetsFromClicks(hitTimesSec: readonly number[], clickTimesSec: readonly number[]): number[] {
  if (clickTimesSec.length === 0) return []
  return hitTimesSec.map((hit) => {
    let nearest = clickTimesSec[0] ?? 0
    for (const click of clickTimesSec) {
      if (Math.abs(hit - click) < Math.abs(hit - nearest)) nearest = click
    }
    return (hit - nearest) * 1000
  })
}

/**
 * Reduce a run of per-hit offsets (ms, in play order) to a stored correction.
 * Warm-up hits are dropped, wild outliers are discarded as mis-hits, and a run
 * whose spread exceeds `maxIqrMs` is reported unusable rather than stored.
 */
export function computeCalibration(offsetsMs: readonly number[]): CalibrationResult {
  const scored = offsetsMs
    .slice(CALIBRATION.firstScoredHit - 1)
    .filter((offset) => Math.abs(offset) <= CALIBRATION.maxPlausibleMs)

  if (scored.length === 0) {
    return { offsetMs: 0, iqrMs: 0, sampleCount: 0, usable: false }
  }

  const offsetMs = median(scored)
  const iqrMs = interquartileRange(scored)
  return {
    offsetMs: Math.round(offsetMs * 10) / 10,
    iqrMs: Math.round(iqrMs * 10) / 10,
    sampleCount: scored.length,
    usable: scored.length >= 4 && iqrMs <= CALIBRATION.maxIqrMs,
  }
}

/** Apply a stored correction to a raw hit time, in seconds (§8.3 step 3). */
export function applyCalibration(hitTimeSec: number, offsetMs: number): number {
  return hitTimeSec - offsetMs / 1000
}
