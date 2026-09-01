import { create } from 'zustand'
import { loadSlice, saveSlice, storageKey, type PersistedSlice } from '@/shared/lib/persist'
import {
  DEFAULT_COUNTING_STYLE,
  isCountingStyle,
  type CountingStyleId,
} from '../lib/counting'

interface PatternDisplaySettings {
  /** How count rows are spelled out (§5, §17). */
  counting: CountingStyleId
}

const DISPLAY_SLICE: PersistedSlice<PatternDisplaySettings> = {
  key: storageKey('pattern-display'),
  version: 1,
  fallback: () => ({ counting: DEFAULT_COUNTING_STYLE }),
}

export interface PatternDisplayStore extends PatternDisplaySettings {
  setCounting: (style: string) => void
}

/**
 * How patterns are *shown*, as opposed to what they are.
 *
 * It lives in the pattern entity because count labels are the pattern entity's
 * data — nothing else has to know that a preference is involved at all.
 */
export const usePatternDisplay = create<PatternDisplayStore>()((set) => ({
  ...loadSlice(DISPLAY_SLICE),

  setCounting(style) {
    // Guard the input: stored data could come from a newer build.
    const counting = isCountingStyle(style) ? style : DEFAULT_COUNTING_STYLE
    saveSlice(DISPLAY_SLICE, { counting })
    set({ counting })
  },
}))

export { DISPLAY_SLICE }
