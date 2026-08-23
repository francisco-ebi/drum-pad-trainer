import { resolvePad, type PadLayout } from '@/entities/device'
import { hitHand, hitsAtStep, type PatternIndex, type Voice } from '@/entities/pattern'
import type { ExpectedHit } from '@/entities/take'

export interface ExpectedContext {
  index: PatternIndex
  /** Only lanes the player owns are judged (§9.2). */
  isUserLane: (voice: Voice) => boolean
  layout?: PadLayout
  leftHanded?: boolean
}

/**
 * The notes the player owes on one scheduled step.
 *
 * The live take calls this once per `schedule` event, so the expected timeline
 * is built from the same events that produce the audio — the judge cannot
 * drift away from what was actually played. `buildTakeTimeline` drives the
 * same function over a synthetic clock for scripted takes and tests.
 */
export function expectedHitsForStep(
  { index, isUserLane, layout, leftHanded }: ExpectedContext,
  patternStep: number,
  time: number,
  loop: number,
): ExpectedHit[] {
  const out: ExpectedHit[] = []
  for (const hit of hitsAtStep(index, patternStep)) {
    if (!isUserLane(hit.voice)) continue
    const hand = hitHand(hit)
    const pad = resolvePad(hit.voice, hand, {
      ...(layout ? { layout } : {}),
      ...(leftHanded === undefined ? {} : { leftHanded }),
    })
    if (!pad) continue
    out.push({
      id: `${loop}:${patternStep}:${hit.voice}:${hand}`,
      voice: hit.voice,
      hand,
      pad,
      time,
      patternStep,
      loop,
    })
  }
  return out
}

export interface TimelineOptions extends ExpectedContext {
  /** How many passes through the loop the take runs for. */
  loops: number
  secondsPerStep: number
  /** Audio-clock time of the first step. */
  startTime?: number
  /** A/B range in pattern steps, `[start, end)`; defaults to the whole pattern. */
  range?: [number, number]
}

/** Every note a take will ask for, laid out on the audio clock. */
export function buildTakeTimeline({
  loops,
  secondsPerStep,
  startTime = 0,
  range,
  ...context
}: TimelineOptions): ExpectedHit[] {
  const [rangeStart, rangeEnd] = range ?? [0, context.index.totalSteps]
  const length = rangeEnd - rangeStart
  const out: ExpectedHit[] = []

  for (let loop = 0; loop < loops; loop++) {
    for (let offset = 0; offset < length; offset++) {
      const time = startTime + (loop * length + offset) * secondsPerStep
      out.push(...expectedHitsForStep(context, rangeStart + offset, time, loop))
    }
  }
  return out
}

/** Notes still to come within one beat — what the approach rings track (§6.3). */
export function upcomingWithin(
  hits: readonly ExpectedHit[],
  nowSec: number,
  horizonSec: number,
): ExpectedHit[] {
  return hits.filter((hit) => hit.time >= nowSec && hit.time <= nowSec + horizonSec)
}
