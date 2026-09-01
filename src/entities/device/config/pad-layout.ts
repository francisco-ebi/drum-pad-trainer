import type { Voice } from '@/entities/pattern/@x/device'
import { PAD_COLS, PAD_ROWS, type PadIndex } from '@/shared/config'

export type PadLayout = readonly (readonly Voice[])[]

/**
 * Default 4x4 layout (§4.1), row 1 = top row as printed on the overlay.
 *
 * Rationale worth preserving in any future preset:
 *  - the backbeat voices (snare, kick) are mirrored across the two centre
 *    columns so either hand can play them;
 *  - two hi-hat pads (row 2, cols 1 and 3) make alternating-hands 16ths
 *    playable — lead hand on one pad, alternate hand on the other;
 *  - the outer columns are "colours" (cymbals, sidestick, shaker) with toms on
 *    top, mimicking a kit's spatial logic.
 *
 * The shaker sits on (3,1), which §4.1 gave to a second sidestick. Sidestick's
 * *lead* pad was always (3,4), so nothing that already used it has moved.
 */
export const DEFAULT_PAD_LAYOUT: PadLayout = [
  ['tomLow', 'tomMid', 'tomHigh', 'cymbalA'],
  ['hihat', 'openhat', 'hihat', 'ride'],
  ['shaker', 'snare', 'snare', 'sidestick'],
  ['cymbalB', 'kick', 'kick', 'cymbalC'],
]

export function voiceAtPad(pad: PadIndex, layout: PadLayout = DEFAULT_PAD_LAYOUT): Voice | undefined {
  return layout[pad.row - 1]?.[pad.col - 1]
}

/** Every pad of a voice, in reading order. */
export function padsForVoice(voice: Voice, layout: PadLayout = DEFAULT_PAD_LAYOUT): PadIndex[] {
  const pads: PadIndex[] = []
  for (let row = 1; row <= PAD_ROWS; row++) {
    for (let col = 1; col <= PAD_COLS; col++) {
      if (layout[row - 1]?.[col - 1] === voice) pads.push({ row, col })
    }
  }
  return pads
}
