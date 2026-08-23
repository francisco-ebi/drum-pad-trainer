/** Pure musical-time math (§7.3). No clock, no state — exhaustively testable.
 *
 *  `subdivision` is defined by the pattern schema as steps-per-bar in 4/4
 *  (8 = eighth notes, 16 = sixteenths), so steps-per-beat is `subdivision / 4`
 *  and other metres scale from the numerator of the time signature.
 */
export type TimeSig = readonly [number, number]

export function stepsPerBeat(subdivision: number): number {
  return subdivision / 4
}

export function stepsPerBar(timeSig: TimeSig, subdivision: number): number {
  return timeSig[0] * stepsPerBeat(subdivision)
}

export function secondsPerBeat(bpm: number): number {
  return 60 / bpm
}

export function secondsPerStep(bpm: number, subdivision: number): number {
  return secondsPerBeat(bpm) / stepsPerBeat(subdivision)
}

export function secondsPerBar(bpm: number, timeSig: TimeSig, subdivision: number): number {
  return secondsPerStep(bpm, subdivision) * stepsPerBar(timeSig, subdivision)
}

export function stepsToSeconds(steps: number, bpm: number, subdivision: number): number {
  return steps * secondsPerStep(bpm, subdivision)
}

export function secondsToSteps(seconds: number, bpm: number, subdivision: number): number {
  return seconds / secondsPerStep(bpm, subdivision)
}

/** Absolute step index -> (bar, step-within-bar). */
export function toBarStep(absoluteStep: number, perBar: number): { bar: number; step: number } {
  const bar = Math.floor(absoluteStep / perBar)
  return { bar, step: absoluteStep - bar * perBar }
}

export function fromBarStep(bar: number, step: number, perBar: number): number {
  return bar * perBar + step
}

/** True modulo (JS `%` keeps the sign of the dividend). */
export function mod(n: number, m: number): number {
  return ((n % m) + m) % m
}

/** Is this absolute step on a beat (a countable `1 2 3 4`)? */
export function isBeatStep(absoluteStep: number, subdivision: number): boolean {
  return mod(absoluteStep, stepsPerBeat(subdivision)) === 0
}
