import { describe, expect, it } from 'vitest'
import { indexPattern } from '../lib/query'
import { validatePattern } from '../lib/validate'
import type { Pattern, Voice } from '../model/types'
import { getPattern } from './index'

const LOFI_IDS = [
  'lofi-boom-bap',
  'lofi-half-time',
  'lofi-ghost-notes',
  'lofi-sidestick',
  'lofi-open-hat',
]

function load(id: string): Pattern {
  const pattern = getPattern(id)
  if (!pattern) throw new Error(`Missing ${id}`)
  return pattern
}

/** Lane as a string: ● struck, A accented, o ghosted. */
function lane(pattern: Pattern, voice: Voice): string {
  const row = indexPattern(pattern).lanes.find((entry) => entry.voice === voice)
  if (!row) return ''
  return row.cells
    .map((hit) => (!hit ? '.' : hit.ghost ? 'o' : hit.accent ? 'A' : '●'))
    .join('')
}

describe('lo-fi grooves', () => {
  it('all validate', () => {
    for (const id of LOFI_IDS) {
      expect({ id, issues: validatePattern(load(id)) }).toEqual({ id, issues: [] })
    }
  })

  it('all carry a swung feel — it is what makes them lo-fi', () => {
    for (const id of LOFI_IDS) {
      const swing = load(id).swing ?? 0
      expect({ id, swung: swing > 0 && swing <= 1 }).toEqual({ id, swung: true })
    }
  })

  it('all sit at an unhurried tempo', () => {
    for (const id of LOFI_IDS) {
      const pattern = load(id)
      expect({ id, bpm: pattern.bpmDefault }).toEqual({ id, bpm: expect.any(Number) })
      expect(pattern.bpmDefault).toBeLessThanOrEqual(85)
      expect(pattern.bpmDefault).toBeGreaterThanOrEqual(60)
    }
  })

  it('boom bap puts the push on the a of 2', () => {
    const pattern = load('lofi-boom-bap')
    expect(lane(pattern, 'kick')).toBe('●......●..●.....')
    expect(lane(pattern, 'snare')).toBe('....●.......●...')
  })

  it('half-time drops to one snare, on beat 3', () => {
    const pattern = load('lofi-half-time')
    const snare = lane(pattern, 'snare')
    expect(snare).toBe('........●.......')
    expect(snare.split('●').length - 1).toBe(1)
  })

  it('ghost notes are ghosted and the backbeat is accented', () => {
    const pattern = load('lofi-ghost-notes')
    expect(lane(pattern, 'snare')).toBe('...oA..o...oA...')

    const snares = pattern.hits.filter((hit) => hit.voice === 'snare')
    expect(snares.filter((hit) => hit.ghost)).toHaveLength(3)
    expect(snares.filter((hit) => hit.accent)).toHaveLength(2)
    // A hit is never both, and the accents are the backbeat.
    expect(snares.every((hit) => !(hit.accent && hit.ghost))).toBe(true)
    expect(snares.filter((hit) => hit.accent).map((hit) => hit.step)).toEqual([4, 12])
  })

  it('the sidestick groove keeps everything soft', () => {
    const pattern = load('lofi-sidestick')
    expect(lane(pattern, 'sidestick')).toBe('....●.......●...')
    expect(lane(pattern, 'shaker')).toBe('..●...●...●...●.')
    // Hats are ghosted throughout — the rim carries the backbeat, not the kit.
    expect(pattern.hits.filter((hit) => hit.voice === 'hihat').every((hit) => hit.ghost)).toBe(true)
    expect(pattern.hits.some((hit) => hit.voice === 'snare')).toBe(false)
  })

  it('the open hat lands on the last & and the hats step aside for it', () => {
    const pattern = load('lofi-open-hat')
    expect(lane(pattern, 'openhat')).toBe('..............●.')
    expect(lane(pattern, 'hihat')).toBe('●.●.●.●.●.●.●...')
  })

  it('are the first patterns to use accents and ghosts at all', () => {
    const dynamic = LOFI_IDS.flatMap((id) => load(id).hits).filter((hit) => hit.accent ?? hit.ghost)
    expect(dynamic.length).toBeGreaterThan(0)
  })
})
