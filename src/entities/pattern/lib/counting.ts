import type { Pattern } from '../model/types'
import type { PatternIndex } from './query'
import { patternStepsPerBar } from './validate'

/**
 * How the count row is spelled out.
 *
 * §5 makes count labels pattern data so a seed can follow the book it came
 * from, and §17 keeps it that way. But a player counts one way in their head,
 * whichever book a groove came out of — so the stored labels are the default,
 * not the only option, and this re-spells them on demand.
 */
export type CountingStyleId = 'source' | 'sixteenths' | 'eighth-numbers' | 'numbered'

export interface CountingStyle {
  id: CountingStyleId
  label: string
  /** Shown next to the option so the choice is obvious without trying it. */
  example: string
  description: string
}

export const COUNTING_STYLES: readonly CountingStyle[] = [
  {
    id: 'source',
    label: 'As written',
    example: 'varies by pattern',
    description: 'Each pattern keeps the counting of the book it was transcribed from.',
  },
  {
    id: 'sixteenths',
    label: 'Beats and syllables',
    example: '1 e & a 2 e & a',
    description: 'Number the beats, then e, & and a between them.',
  },
  {
    id: 'eighth-numbers',
    label: 'Numbered eighths',
    example: '1 + 2 + 3 + 4 +',
    description: 'Number every eighth note, with a + for the sixteenth between.',
  },
  {
    id: 'numbered',
    label: 'Numbered steps',
    example: '1 2 3 4 5 6 …',
    description: 'Number every step of the bar. Useful for odd metres.',
  },
]

export const DEFAULT_COUNTING_STYLE: CountingStyleId = 'source'

export function isCountingStyle(value: unknown): value is CountingStyleId {
  return COUNTING_STYLES.some((style) => style.id === value)
}

type Metre = Pick<Pattern, 'countLabels' | 'timeSig' | 'subdivision'>

/** Syllables within one beat, for the "beats and syllables" style. */
function beatSyllables(stepsPerBeat: number): string[] {
  if (stepsPerBeat === 4) return ['', 'e', '&', 'a']
  if (stepsPerBeat === 2) return ['', '&']
  if (stepsPerBeat === 1) return ['']
  // Any other subdivision: number the beat and mark the rest.
  return ['', ...Array.from({ length: stepsPerBeat - 1 }, () => '·')]
}

/**
 * One bar of labels in the requested style. Unknown styles — data written by a
 * newer build — fall back to the pattern's own labels rather than throwing.
 */
export function countLabelsFor(style: string, pattern: Metre): string[] {
  const perBar = patternStepsPerBar(pattern)
  const stepsPerBeat = pattern.subdivision / 4

  switch (style) {
    case 'sixteenths': {
      const syllables = beatSyllables(stepsPerBeat)
      return Array.from({ length: perBar }, (_, step) => {
        const beat = Math.floor(step / stepsPerBeat) + 1
        const within = step % stepsPerBeat
        return within === 0 ? String(beat) : (syllables[within] ?? '·')
      })
    }
    case 'eighth-numbers': {
      // The eighth note is the unit; a sixteenth pattern puts a + between.
      const stepsPerEighth = Math.max(1, Math.round(stepsPerBeat / 2))
      return Array.from({ length: perBar }, (_, step) => {
        const within = step % stepsPerEighth
        return within === 0 ? String(Math.floor(step / stepsPerEighth) + 1) : '+'
      })
    }
    case 'numbered':
      return Array.from({ length: perBar }, (_, step) => String(step + 1))
    default:
      return [...pattern.countLabels]
  }
}

/**
 * Labels for every step of a pattern, bars included — what the sequencer and
 * filmstrip render. The per-bar labels simply repeat.
 */
export function displayLabels(index: PatternIndex, style: string): string[] {
  if (style === 'source') return index.labels
  const perBar = countLabelsFor(style, index.pattern)
  return Array.from({ length: index.totalSteps }, (_, step) => perBar[step % perBar.length] ?? '')
}
