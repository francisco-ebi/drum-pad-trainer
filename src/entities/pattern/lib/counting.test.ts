import { describe, expect, it } from 'vitest'
import { getPattern } from '../seeds'
import type { Pattern } from '../model/types'
import {
  countLabelsFor,
  displayLabels,
  isCountingStyle,
  COUNTING_STYLES,
  DEFAULT_COUNTING_STYLE,
} from './counting'
import { indexPattern } from './query'

function metre(subdivision: 8 | 16, countLabels: string[] = [], beats = 4): Pattern {
  return {
    id: 'x',
    title: 'x',
    level: 1,
    timeSig: [beats, 4],
    subdivision,
    bars: 1,
    bpmDefault: 80,
    bpmRange: [40, 160],
    countLabels,
    lanes: ['kick'],
    hits: [],
  }
}

describe('counting styles (§5, §17)', () => {
  it('defaults to whatever the pattern was written with', () => {
    expect(DEFAULT_COUNTING_STYLE).toBe('source')
    const pattern = metre(8, ['1', 'a', '2', 'a', '3', 'a', '4', 'a'])
    expect(countLabelsFor('source', pattern)).toEqual(pattern.countLabels)
  })

  it('never hands back the pattern’s own array to be mutated', () => {
    const pattern = metre(8, ['1', 'a', '2', 'a', '3', 'a', '4', 'a'])
    expect(countLabelsFor('source', pattern)).not.toBe(pattern.countLabels)
  })

  it('spells sixteenths as beats and syllables', () => {
    expect(countLabelsFor('sixteenths', metre(16)).join('')).toBe('1e&a2e&a3e&a4e&a')
  })

  it('spells eighths as beats and &', () => {
    expect(countLabelsFor('sixteenths', metre(8)).join('')).toBe('1&2&3&4&')
  })

  it('numbers the eighths, with a + for the sixteenth between', () => {
    expect(countLabelsFor('eighth-numbers', metre(16)).join('')).toBe('1+2+3+4+5+6+7+8+')
  })

  it('numbers every eighth when the pattern is already in eighths', () => {
    expect(countLabelsFor('eighth-numbers', metre(8))).toEqual([
      '1', '2', '3', '4', '5', '6', '7', '8',
    ])
  })

  it('numbers every step', () => {
    expect(countLabelsFor('numbered', metre(8))).toEqual([
      '1', '2', '3', '4', '5', '6', '7', '8',
    ])
    expect(countLabelsFor('numbered', metre(16)).at(-1)).toBe('16')
  })

  it('handles a metre other than 4/4', () => {
    expect(countLabelsFor('sixteenths', metre(8, [], 3)).join('')).toBe('1&2&3&')
    expect(countLabelsFor('numbered', metre(8, [], 3))).toHaveLength(6)
  })

  it('falls back to the pattern’s labels for a style it does not know', () => {
    const pattern = metre(8, ['1', 'a', '2', 'a', '3', 'a', '4', 'a'])
    // Data written by a newer build must not throw or blank the count row.
    expect(countLabelsFor('from-the-future', pattern)).toEqual(pattern.countLabels)
  })

  it('recognises only the styles it offers', () => {
    for (const style of COUNTING_STYLES) expect(isCountingStyle(style.id)).toBe(true)
    expect(isCountingStyle('nope')).toBe(false)
    expect(isCountingStyle(undefined)).toBe(false)
  })
})

describe('display labels across a whole pattern', () => {
  it('repeats the per-bar labels over every bar', () => {
    const pattern = getPattern('afro-funk-1')
    expect(pattern).toBeDefined()
    if (!pattern) return
    const index = indexPattern(pattern)

    const source = displayLabels(index, 'source')
    expect(source).toHaveLength(32)
    expect(source.slice(0, 16).join('')).toBe('1+2+3+4+5+6+7+8+')

    const american = displayLabels(index, 'sixteenths')
    expect(american).toHaveLength(32)
    expect(american.slice(0, 16).join('')).toBe('1e&a2e&a3e&a4e&a')
    expect(american.slice(16).join('')).toBe('1e&a2e&a3e&a4e&a')
  })

  it('re-spells a pattern written in one convention into another', () => {
    // Variation #1 is written "1 a 2 a"; a player counting "1 e & a" sees that.
    const pattern = getPattern('variation-1')
    expect(pattern).toBeDefined()
    if (!pattern) return
    const index = indexPattern(pattern)
    expect(displayLabels(index, 'source').join('')).toBe('1a2a3a4a')
    expect(displayLabels(index, 'sixteenths').join('')).toBe('1&2&3&4&')
    expect(displayLabels(index, 'eighth-numbers').join('')).toBe('12345678')
  })

  it('leaves the stored index untouched', () => {
    const pattern = getPattern('variation-1')
    if (!pattern) throw new Error('missing')
    const index = indexPattern(pattern)
    const before = [...index.labels]
    displayLabels(index, 'numbered')
    expect(index.labels).toEqual(before)
  })
})
