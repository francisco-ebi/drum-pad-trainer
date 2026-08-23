import type { Hand, Voice } from '@/entities/pattern/@x/device'
import type { PadIndex } from '@/shared/config'
import { DEFAULT_PAD_LAYOUT, padsForVoice, type PadLayout } from '../config/pad-layout'

export interface ResolveOptions {
  layout?: PadLayout
  /** Swaps the lead/alternate convention globally (Settings, §4.2). */
  leftHanded?: boolean
}

/**
 * A voice's pads ordered `[lead, alt?]` (§4.2). By default the right-hand
 * instance — the rightmost pad — leads; the left-handed toggle mirrors that.
 */
export function orderedPads(voice: Voice, { layout = DEFAULT_PAD_LAYOUT, leftHanded = false }: ResolveOptions = {}): PadIndex[] {
  const pads = padsForVoice(voice, layout)
  if (pads.length < 2) return pads
  const byColumn = [...pads].sort((a, b) => b.col - a.col || a.row - b.row)
  return leftHanded ? [...byColumn].reverse() : byColumn
}

/**
 * Resolve a hit's `voice + hand` to a physical pad. Voices with a single pad
 * ignore the hand for pad resolution — the marker still renders, as sticking
 * guidance.
 */
export function resolvePad(voice: Voice, hand: Hand = 'R', options: ResolveOptions = {}): PadIndex | undefined {
  const pads = orderedPads(voice, options)
  if (pads.length === 0) return undefined
  if (hand === 'L' && pads.length > 1) return pads[1]
  return pads[0]
}

/** Does this pad play `voice`? Used by lenient judging (§4.2). */
export function padPlaysVoice(pad: PadIndex, voice: Voice, layout: PadLayout = DEFAULT_PAD_LAYOUT): boolean {
  return layout[pad.row - 1]?.[pad.col - 1] === voice
}
