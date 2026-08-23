import { describe, expect, it } from 'vitest'
import { indexPattern } from '../lib/query'
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
