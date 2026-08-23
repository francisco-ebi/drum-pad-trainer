import { parsePattern } from '../lib/validate'
import type { Pattern } from '../model/types'
import basic8thBeat from './basic-8th-beat.json'
import basic16thBeat from './basic-16th-beat.json'
import variation1 from './variation-1.json'

/**
 * Seed curriculum patterns (§5.1). Parsed through the schema on import, so a
 * malformed JSON edit fails loudly at start-up instead of half-rendering.
 */
export const SEED_PATTERNS: readonly Pattern[] = [basic8thBeat, basic16thBeat, variation1].map(
  (raw) => parsePattern(raw),
)

export const SEED_PATTERNS_BY_ID: ReadonlyMap<string, Pattern> = new Map(
  SEED_PATTERNS.map((pattern) => [pattern.id, pattern]),
)

export function getPattern(id: string): Pattern | undefined {
  return SEED_PATTERNS_BY_ID.get(id)
}

export const DEFAULT_PATTERN_ID = 'variation-1'
