import type { Voice } from '@/entities/pattern/@x/device'
import { ALL_PADS, PAD_COLS, PAD_ROWS, padKey, type PadIndex } from '@/shared/config'
import { DEFAULT_PAD_LAYOUT, type PadLayout } from '../config/pad-layout'
import { orderedPads } from '../lib/resolve-pad'

/**
 * MIDI note number -> pad (§4.3). Several notes may map to one pad — some
 * controllers send different notes per bank — but a note maps to at most one
 * pad, or the same strike would mean two places at once.
 */
export type NoteMapping = Record<number, PadIndex>

export type MappingPresetId = 'general-midi' | 'chromatic-36'

export interface MappingPreset {
  id: MappingPresetId
  label: string
  description: string
  build: (layout?: PadLayout) => NoteMapping
}

/**
 * General MIDI drum map (§4.3). Each GM note lands on the *lead* pad of its
 * voice — a GM device has one note per drum, so the mirrored alternate pads
 * are simply unreachable on it. Lenient judging (§4.2) means that costs
 * nothing outside `strictHands` drills.
 *
 * §4.3 lists cymbal C without a GM note; 55 (splash) is the natural fit. The
 * shaker takes GM 82, its standard percussion note. Both are additions beyond
 * the spec's list.
 */
const GENERAL_MIDI_NOTES: Record<number, Voice> = {
  36: 'kick',
  37: 'sidestick',
  38: 'snare',
  42: 'hihat',
  46: 'openhat',
  51: 'ride',
  82: 'shaker',
  49: 'cymbalA',
  57: 'cymbalB',
  55: 'cymbalC',
  45: 'tomLow',
  47: 'tomMid',
  50: 'tomHigh',
}

function generalMidiMapping(layout: PadLayout = DEFAULT_PAD_LAYOUT): NoteMapping {
  const mapping: NoteMapping = {}
  for (const [note, voice] of Object.entries(GENERAL_MIDI_NOTES)) {
    const pad = orderedPads(voice, { layout })[0]
    if (pad) mapping[Number(note)] = pad
  }
  return mapping
}

/** The common MPD / Launchpad default: bottom-left is 36, ascending
 *  left → right, bottom → top (§4.3). */
export const CHROMATIC_BASE_NOTE = 36

function chromaticMapping(): NoteMapping {
  const mapping: NoteMapping = {}
  for (let index = 0; index < PAD_ROWS * PAD_COLS; index++) {
    const rowFromBottom = Math.floor(index / PAD_COLS)
    mapping[CHROMATIC_BASE_NOTE + index] = {
      row: PAD_ROWS - rowFromBottom,
      col: (index % PAD_COLS) + 1,
    }
  }
  return mapping
}

export const MAPPING_PRESETS: readonly MappingPreset[] = [
  {
    id: 'general-midi',
    label: 'General MIDI drums',
    description: 'Kick 36, snare 38, closed hat 42 — most e-drum modules and software kits.',
    build: generalMidiMapping,
  },
  {
    id: 'chromatic-36',
    label: 'Chromatic from 36',
    description: 'Bottom-left pad is note 36, ascending left to right — most MPD / Launchpad pads.',
    build: chromaticMapping,
  },
]

export function buildPreset(id: MappingPresetId, layout?: PadLayout): NoteMapping {
  const preset = MAPPING_PRESETS.find((candidate) => candidate.id === id)
  if (!preset) throw new Error(`Unknown mapping preset: ${id}`)
  return preset.build(layout)
}

export function noteToPad(mapping: NoteMapping, note: number): PadIndex | undefined {
  return mapping[note]
}

/** Every note that reaches a pad — the learn wizard shows these back. */
export function notesForPad(mapping: NoteMapping, pad: PadIndex): number[] {
  const target = padKey(pad)
  return Object.entries(mapping)
    .filter(([, mapped]) => padKey(mapped) === target)
    .map(([note]) => Number(note))
    .sort((a, b) => a - b)
}

/** Pads with no note pointing at them — an incomplete learn run, or a
 *  controller that simply cannot reach them. */
export function unmappedPads(mapping: NoteMapping): PadIndex[] {
  return ALL_PADS.filter((pad) => notesForPad(mapping, pad).length === 0)
}

/** Assign a note to a pad, dropping any pad it previously pointed at. */
export function assignNote(mapping: NoteMapping, note: number, pad: PadIndex): NoteMapping {
  return { ...mapping, [note]: pad }
}

/** Drop every note currently pointing at a pad (learn wizard re-runs). */
export function clearPad(mapping: NoteMapping, pad: PadIndex): NoteMapping {
  const next: NoteMapping = {}
  const target = padKey(pad)
  for (const [note, mapped] of Object.entries(mapping)) {
    if (padKey(mapped) !== target) next[Number(note)] = mapped
  }
  return next
}
