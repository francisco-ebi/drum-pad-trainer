import { describe, expect, it } from 'vitest'
import { indexPattern, stepCount } from '../lib/query'
import { validatePattern } from '../lib/validate'
import type { Pattern, Voice } from '../model/types'
import { getPattern, REFERENCE_PATTERN_IDS, SEED_PATTERNS } from './index'

/** Render one lane as a string so a seed can be read against the §5.1 tables. */
function lane(pattern: Pattern, voice: Voice): string {
  const index = indexPattern(pattern)
  const row = index.lanes.find((l) => l.voice === voice)
  if (!row) return ''
  return row.cells.map((hit) => (hit ? (hit.hand === 'L' ? '◆' : '●') : '.')).join('')
}

describe('seed patterns', () => {
  it('all validate against the schema', () => {
    for (const pattern of SEED_PATTERNS) {
      expect({ id: pattern.id, issues: validatePattern(pattern) }).toEqual({
        id: pattern.id,
        issues: [],
      })
    }
  })

  it('ships the three reference patterns from §5.1', () => {
    for (const id of REFERENCE_PATTERN_IDS) {
      expect(getPattern(id)).toBeDefined()
    }
  })

  it('gives every pattern a unique id', () => {
    const ids = SEED_PATTERNS.map((pattern) => pattern.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ships enough patterns to build the seed curriculum (§16 M3)', () => {
    expect(SEED_PATTERNS.length).toBeGreaterThanOrEqual(12)
  })

  it('keeps every pattern playable at its default tempo', () => {
    for (const pattern of SEED_PATTERNS) {
      const [min, max] = pattern.bpmRange
      expect({ id: pattern.id, ok: pattern.bpmDefault >= min && pattern.bpmDefault <= max }).toEqual({
        id: pattern.id,
        ok: true,
      })
    }
  })

  it('gives every pattern a drill block with coaching notes', () => {
    for (const pattern of SEED_PATTERNS) {
      expect({ id: pattern.id, hasDrill: pattern.drill !== undefined }).toEqual({
        id: pattern.id,
        hasDrill: true,
      })
      expect(pattern.drill?.notes?.length ?? 0).toBeGreaterThan(0)
    }
  })

  it('Basic 8th note beat matches the reference table', () => {
    const pattern = getPattern('basic-8th-beat')
    expect(pattern).toBeDefined()
    if (!pattern) return
    expect(pattern.countLabels).toEqual(['1', 'a', '2', 'a', '3', 'a', '4', 'a'])
    expect(lane(pattern, 'hihat')).toBe('●●●●●●●●')
    expect(lane(pattern, 'snare')).toBe('..●...●.')
    expect(lane(pattern, 'kick')).toBe('●...●...')
  })

  it('Basic 16th note beat alternates hi-hat hands', () => {
    const pattern = getPattern('basic-16th-beat')
    expect(pattern).toBeDefined()
    if (!pattern) return
    expect(pattern.countLabels.join('')).toBe('1e&a2e&a3e&a4e&a')
    expect(lane(pattern, 'hihat')).toBe('●◆●◆●◆●◆●◆●◆●◆●◆')
    expect(lane(pattern, 'snare')).toBe('....●.......●...')
    expect(lane(pattern, 'kick')).toBe('●.......●.......')
  })

  it('Variation #1 swaps the last hi-hat for an open hat and adds kicks', () => {
    const pattern = getPattern('variation-1')
    expect(pattern).toBeDefined()
    if (!pattern) return
    expect(lane(pattern, 'openhat')).toBe('.......●')
    expect(lane(pattern, 'hihat')).toBe('●●●●●●●.')
    expect(lane(pattern, 'snare')).toBe('..●...●.')
    expect(lane(pattern, 'kick')).toBe('●...●●.●')
    expect(pattern.lanes).toEqual(['openhat', 'hihat', 'snare', 'kick'])
  })

  it('returns undefined for an unknown id', () => {
    expect(getPattern('nope')).toBeUndefined()
  })
})

/**
 * The three fills share one skeleton — hats on 1 & 2 &, snare on 2, open hat
 * and kick on 3 — then a seven-stroke run from the e of 3 in strict L R L R
 * L R L alternation, which leaves the lead hand free for the crash.
 *
 * The reference grids draw a 17th column for the next bar's downbeat; looped,
 * that column is step 0, so the crash sits there.
 */
describe('fill patterns', () => {
  const FILLS = ['fill-1-snare-run', 'fill-2-descending-toms', 'fill-3-snare-into-toms']

  it('all share the groove the fill hangs off', () => {
    for (const id of FILLS) {
      const pattern = getPattern(id)
      expect(pattern).toBeDefined()
      if (!pattern) continue
      expect({ id, hats: lane(pattern, 'hihat') }).toEqual({ id, hats: '●.●.●.●.........' })
      expect({ id, kick: lane(pattern, 'kick') }).toEqual({ id, kick: '●.......●.......' })
      expect({ id, open: lane(pattern, 'openhat') }).toEqual({ id, open: '........●.......' })
      expect({ id, crash: lane(pattern, 'cymbalA') }).toEqual({ id, crash: '●...............' })
    }
  })

  it('runs seven strokes from the e of 3, alternating and ending on the alternate hand', () => {
    for (const id of FILLS) {
      const pattern = getPattern(id)
      if (!pattern) throw new Error(id)
      const run = pattern.hits
        .filter((hit) => hit.step >= 9)
        .sort((a, b) => a.step - b.step)
      expect({ id, count: run.length }).toEqual({ id, count: 7 })
      expect({ id, steps: run.map((hit) => hit.step) }).toEqual({
        id,
        steps: [9, 10, 11, 12, 13, 14, 15],
      })
      expect({ id, hands: run.map((hit) => hit.hand ?? 'R').join('') }).toEqual({
        id,
        hands: 'LRLRLRL',
      })
    }
  })

  it('Fill #1 keeps the whole run on the snare', () => {
    const pattern = getPattern('fill-1-snare-run')
    expect(pattern).toBeDefined()
    if (!pattern) return
    expect(lane(pattern, 'snare')).toBe('....●....◆●◆●◆●◆')
  })

  it('Fill #2 walks down high, mid and low tom', () => {
    const pattern = getPattern('fill-2-descending-toms')
    expect(pattern).toBeDefined()
    if (!pattern) return
    expect(lane(pattern, 'tomHigh')).toBe('.........◆●.....')
    expect(lane(pattern, 'tomMid')).toBe('...........◆●...')
    expect(lane(pattern, 'tomLow')).toBe('.............◆●◆')
    expect(lane(pattern, 'snare')).toBe('....●...........')
  })

  it('Fill #3 drops from the snare through the toms and back', () => {
    const pattern = getPattern('fill-3-snare-into-toms')
    expect(pattern).toBeDefined()
    if (!pattern) return
    expect(lane(pattern, 'snare')).toBe('....●....◆●....◆')
    expect(lane(pattern, 'tomMid')).toBe('...........◆●...')
    expect(lane(pattern, 'tomLow')).toBe('.............◆●.')
  })

  it('orders lanes as the reference grids read, top to bottom', () => {
    expect(getPattern('fill-2-descending-toms')?.lanes).toEqual([
      'cymbalA',
      'tomHigh',
      'tomMid',
      'tomLow',
      'openhat',
      'hihat',
      'snare',
      'kick',
    ])
  })
})

/**
 * The first two-bar pattern in the library, transcribed from a grid that
 * counts eighths 1–8 with a '+' between rather than "1 e & a" — which is
 * exactly why count labels are pattern data and not code (§5, §17).
 */
describe('Afro-Funk I (two bars)', () => {
  const pattern = getPattern('afro-funk-1')

  /** One lane across both bars, bars separated. */
  function bars(voice: Voice): string[] {
    if (!pattern) return []
    const index = indexPattern(pattern)
    const row = index.lanes.find((entry) => entry.voice === voice)
    if (!row) return []
    const perBar = row.cells.length / pattern.bars
    return Array.from({ length: pattern.bars }, (_, bar) =>
      row.cells
        .slice(bar * perBar, (bar + 1) * perBar)
        .map((hit) => (hit ? (hit.hand === 'L' ? '◆' : '●') : '.'))
        .join(''),
    )
  }

  it('spans two bars of sixteenths', () => {
    expect(pattern).toBeDefined()
    if (!pattern) return
    expect(pattern.bars).toBe(2)
    expect(pattern.subdivision).toBe(16)
    expect(stepCount(pattern)).toBe(32)
  })

  it('counts the eighths 1–8, as the source does', () => {
    expect(pattern?.countLabels.join('')).toBe('1+2+3+4+5+6+7+8+')
  })

  it('runs the shaker figure in every half bar', () => {
    expect(bars('shaker')).toEqual(['●.●●....●.●●....', '●.●●....●.●●....'])
  })

  it('keeps the hats running through both bars', () => {
    expect(bars('hihat')).toEqual(['●◆●◆●◆●◆●◆●◆●◆●◆', '●◆●◆●◆●◆●◆●◆●◆●◆'])
  })

  it('holds the backbeat in both bars', () => {
    expect(bars('snare')).toEqual(['....●.......●...', '....●.......●...'])
  })

  it('opens both bars alike and pushes only in the second', () => {
    // 1, the + after 2, then 4 — identical in both bars. The second bar adds a
    // push on the + after 5 before landing on 6.
    expect(bars('kick')).toEqual(['●..●..●...●.....', '●..●..●..●●.....'])
  })

  it('shares the first three kicks across the two bars', () => {
    const [first, second] = bars('kick')
    expect(first?.slice(0, 9)).toBe(second?.slice(0, 9))
  })

  it('brings the toms in only for the second bar', () => {
    expect(bars('tomMid')).toEqual(['................', '........●...●●●●'])
  })

  it('repeats its labels for every bar', () => {
    expect(pattern).toBeDefined()
    if (!pattern) return
    const index = indexPattern(pattern)
    expect(index.labels).toHaveLength(32)
    expect(index.labels.slice(0, 16)).toEqual(index.labels.slice(16))
  })
})
