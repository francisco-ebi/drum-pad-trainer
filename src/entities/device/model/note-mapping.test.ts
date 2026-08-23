import { describe, expect, it } from 'vitest'
import { ALL_PADS, padKey } from '@/shared/config'
import { voiceAtPad } from '../config/pad-layout'
import {
  assignNote,
  buildPreset,
  CHROMATIC_BASE_NOTE,
  clearPad,
  MAPPING_PRESETS,
  noteToPad,
  notesForPad,
  unmappedPads,
} from './note-mapping'

describe('mapping presets', () => {
  it('offers the two presets from §4.3', () => {
    expect(MAPPING_PRESETS.map((p) => p.id)).toEqual(['general-midi', 'chromatic-36'])
  })

  it('puts the General MIDI drums on the right voices', () => {
    const mapping = buildPreset('general-midi')
    const voiceOf = (note: number) => {
      const pad = noteToPad(mapping, note)
      return pad ? voiceAtPad(pad) : undefined
    }
    expect(voiceOf(36)).toBe('kick')
    expect(voiceOf(37)).toBe('sidestick')
    expect(voiceOf(38)).toBe('snare')
    expect(voiceOf(42)).toBe('hihat')
    expect(voiceOf(46)).toBe('openhat')
    expect(voiceOf(51)).toBe('ride')
    expect(voiceOf(49)).toBe('cymbalA')
    expect(voiceOf(45)).toBe('tomLow')
    expect(voiceOf(47)).toBe('tomMid')
    expect(voiceOf(50)).toBe('tomHigh')
  })

  it('sends GM notes to the lead pad of each mirrored voice', () => {
    const mapping = buildPreset('general-midi')
    expect(noteToPad(mapping, 36)).toEqual({ row: 4, col: 3 })
    expect(noteToPad(mapping, 38)).toEqual({ row: 3, col: 3 })
    expect(noteToPad(mapping, 42)).toEqual({ row: 2, col: 3 })
  })

  it('lays the chromatic preset out bottom-left ascending', () => {
    const mapping = buildPreset('chromatic-36')
    expect(noteToPad(mapping, CHROMATIC_BASE_NOTE)).toEqual({ row: 4, col: 1 })
    expect(noteToPad(mapping, 39)).toEqual({ row: 4, col: 4 })
    expect(noteToPad(mapping, 40)).toEqual({ row: 3, col: 1 })
    expect(noteToPad(mapping, 51)).toEqual({ row: 1, col: 4 })
  })

  it('reaches all 16 pads chromatically, and only the lead pads via GM', () => {
    expect(unmappedPads(buildPreset('chromatic-36'))).toEqual([])
    const gmUnmapped = unmappedPads(buildPreset('general-midi')).map(padKey)
    // The mirrored alternates are unreachable on a one-note-per-drum device.
    expect(gmUnmapped).toContain(padKey({ row: 2, col: 1 }))
    expect(gmUnmapped).toContain(padKey({ row: 3, col: 2 }))
    expect(gmUnmapped).toContain(padKey({ row: 4, col: 2 }))
  })

  it('maps every chromatic note to a distinct pad', () => {
    const mapping = buildPreset('chromatic-36')
    const pads = Object.values(mapping).map(padKey)
    expect(new Set(pads).size).toBe(ALL_PADS.length)
  })

  it('throws on an unknown preset', () => {
    // @ts-expect-error deliberately invalid preset id
    expect(() => buildPreset('nope')).toThrow(/Unknown mapping preset/)
  })
})

describe('learn-wizard edits', () => {
  it('assigns a note and lets several notes share a pad', () => {
    const pad = { row: 1, col: 1 }
    let mapping = assignNote({}, 60, pad)
    mapping = assignNote(mapping, 72, pad)
    expect(notesForPad(mapping, pad)).toEqual([60, 72])
  })

  it('moves a note rather than duplicating it', () => {
    let mapping = assignNote({}, 60, { row: 1, col: 1 })
    mapping = assignNote(mapping, 60, { row: 2, col: 2 })
    expect(noteToPad(mapping, 60)).toEqual({ row: 2, col: 2 })
    expect(notesForPad(mapping, { row: 1, col: 1 })).toEqual([])
  })

  it('clears every note pointing at a pad, for a re-run', () => {
    const pad = { row: 3, col: 3 }
    let mapping = assignNote(assignNote({}, 38, pad), 40, pad)
    mapping = assignNote(mapping, 36, { row: 4, col: 3 })
    mapping = clearPad(mapping, pad)
    expect(notesForPad(mapping, pad)).toEqual([])
    expect(noteToPad(mapping, 36)).toEqual({ row: 4, col: 3 })
  })
})
