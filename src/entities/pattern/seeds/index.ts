import { parsePattern } from '../lib/validate'
import type { Pattern } from '../model/types'
import alternatingHats16 from './alternating-hats-16.json'
import backbeatSnare from './backbeat-snare.json'
import basic16thBeat from './basic-16th-beat.json'
import basic8thBeat from './basic-8th-beat.json'
import eighthHats from './eighth-hats.json'
import kickSnareIndependence from './kick-snare-independence.json'
import openHatAccents from './open-hat-accents.json'
import quarterKick from './quarter-kick.json'
import rideGroove from './ride-groove.json'
import sidestickGroove from './sidestick-groove.json'
import sixteenthKickVariation from './sixteenth-kick-variation.json'
import variation1 from './variation-1.json'

/**
 * Seed patterns, parsed through the schema on import so a malformed JSON edit
 * fails loudly at start-up instead of half-rendering.
 *
 * Ordered roughly by the curriculum (§11.1), though a pattern's place in a
 * track is decided by `entities/drill`, not by this list — Track 5 reuses
 * earlier patterns at higher tempos.
 */
export const SEED_PATTERNS: readonly Pattern[] = [
  // Track 1 · Foundations
  quarterKick,
  backbeatSnare,
  eighthHats,
  basic8thBeat,
  kickSnareIndependence,
  // Track 2 · Sixteenths & hands
  alternatingHats16,
  basic16thBeat,
  sixteenthKickVariation,
  // Track 3 · Colors
  variation1,
  rideGroove,
  sidestickGroove,
  openHatAccents,
].map((raw) => parsePattern(raw))

export const SEED_PATTERNS_BY_ID: ReadonlyMap<string, Pattern> = new Map(
  SEED_PATTERNS.map((pattern) => [pattern.id, pattern]),
)

export function getPattern(id: string): Pattern | undefined {
  return SEED_PATTERNS_BY_ID.get(id)
}

export const DEFAULT_PATTERN_ID = 'variation-1'

/**
 * The three patterns taken from the reference material (§5.1). Their static
 * filmstrip render is snapshot-tested against those references, so they are
 * named rather than inferred.
 */
export const REFERENCE_PATTERN_IDS = ['basic-8th-beat', 'basic-16th-beat', 'variation-1'] as const
