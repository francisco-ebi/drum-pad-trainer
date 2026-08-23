import type { Hit, Pattern, Voice } from '../model/types'
import { patternStepsPerBar } from './validate'

/**
 * The derived view every renderer works from: the pattern flattened onto an
 * absolute-step timeline. Built once per pattern, then shared by the sequencer,
 * the filmstrip and the playback scheduler, so all three cannot disagree.
 */
export interface PatternIndex {
  pattern: Pattern
  perBar: number
  totalSteps: number
  /** Absolute step -> every hit on it. */
  steps: Hit[][]
  /** Lane order from `pattern.lanes`, each row one cell per absolute step. */
  lanes: { voice: Voice; cells: (Hit | undefined)[] }[]
  /** Count label per absolute step (`pattern.countLabels`, repeated per bar). */
  labels: string[]
}

export function stepCount(pattern: Pick<Pattern, 'bars' | 'timeSig' | 'subdivision'>): number {
  return pattern.bars * patternStepsPerBar(pattern)
}

export function toAbsoluteStep(hit: Pick<Hit, 'bar' | 'step'>, perBar: number): number {
  return hit.bar * perBar + hit.step
}

export function hitKey(hit: Hit): string {
  return `${hit.bar}:${hit.step}:${hit.voice}:${hit.hand ?? 'R'}`
}

export function hitHand(hit: Hit): 'R' | 'L' {
  return hit.hand ?? 'R'
}

export function indexPattern(pattern: Pattern): PatternIndex {
  const perBar = patternStepsPerBar(pattern)
  const totalSteps = pattern.bars * perBar

  const steps: Hit[][] = Array.from({ length: totalSteps }, () => [])
  for (const hit of pattern.hits) {
    const at = toAbsoluteStep(hit, perBar)
    steps[at]?.push(hit)
  }

  const lanes = pattern.lanes.map((voice) => ({
    voice,
    cells: Array.from({ length: totalSteps }, (_, at) => steps[at]?.find((h) => h.voice === voice)),
  }))

  const labels = Array.from({ length: totalSteps }, (_, at) => pattern.countLabels[at % perBar] ?? '')

  return { pattern, perBar, totalSteps, steps, lanes, labels }
}

export function hitsAtStep(index: PatternIndex, absoluteStep: number): Hit[] {
  return index.steps[absoluteStep] ?? []
}

/** Is this step a countable beat (`1 2 3 4`) rather than a subdivision? */
export function isDownbeat(index: PatternIndex, absoluteStep: number): boolean {
  const stepsPerBeat = index.pattern.subdivision / 4
  return absoluteStep % stepsPerBeat === 0
}
