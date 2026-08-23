import { describe, expect, it } from 'vitest'
import { DEFAULT_PAD_LAYOUT, voiceAtPad } from '../config/pad-layout'
import { orderedPads, padPlaysVoice, resolvePad } from './resolve-pad'

describe('pad layout', () => {
  it('matches the printed 4x4 overlay', () => {
    expect(DEFAULT_PAD_LAYOUT).toEqual([
      ['tomLow', 'tomMid', 'tomHigh', 'cymbalA'],
      ['hihat', 'openhat', 'hihat', 'ride'],
      ['sidestick', 'snare', 'snare', 'sidestick'],
      ['cymbalB', 'kick', 'kick', 'cymbalC'],
    ])
    expect(voiceAtPad({ row: 4, col: 2 })).toBe('kick')
    expect(voiceAtPad({ row: 9, col: 9 })).toBeUndefined()
  })

  it('mirrors the backbeat voices across the centre columns', () => {
    expect(orderedPads('snare')).toEqual([
      { row: 3, col: 3 },
      { row: 3, col: 2 },
    ])
    expect(orderedPads('kick')).toEqual([
      { row: 4, col: 3 },
      { row: 4, col: 2 },
    ])
  })
})

describe('voice + hand -> pad', () => {
  it('sends the lead hand to the right-hand instance', () => {
    expect(resolvePad('hihat', 'R')).toEqual({ row: 2, col: 3 })
    expect(resolvePad('hihat', 'L')).toEqual({ row: 2, col: 1 })
    expect(resolvePad('snare', 'R')).toEqual({ row: 3, col: 3 })
    expect(resolvePad('snare', 'L')).toEqual({ row: 3, col: 2 })
    expect(resolvePad('kick', 'R')).toEqual({ row: 4, col: 3 })
    expect(resolvePad('kick', 'L')).toEqual({ row: 4, col: 2 })
  })

  it('defaults to the lead hand', () => {
    expect(resolvePad('hihat')).toEqual(resolvePad('hihat', 'R'))
  })

  it('ignores the hand for single-pad voices', () => {
    expect(resolvePad('ride', 'L')).toEqual({ row: 2, col: 4 })
    expect(resolvePad('openhat', 'L')).toEqual({ row: 2, col: 2 })
  })

  it('swaps the convention for left-handed players', () => {
    expect(resolvePad('hihat', 'R', { leftHanded: true })).toEqual({ row: 2, col: 1 })
    expect(resolvePad('hihat', 'L', { leftHanded: true })).toEqual({ row: 2, col: 3 })
  })

  it('accepts any pad of a voice for lenient judging', () => {
    expect(padPlaysVoice({ row: 2, col: 1 }, 'hihat')).toBe(true)
    expect(padPlaysVoice({ row: 2, col: 3 }, 'hihat')).toBe(true)
    expect(padPlaysVoice({ row: 2, col: 2 }, 'hihat')).toBe(false)
  })
})
