import { MIDI_DEBOUNCE_MS } from '@/shared/config'

/**
 * Pad double-fire protection (§8.1): a retrigger of the same note within
 * 30 ms is the pad bouncing, not the player playing.
 *
 * Per note, not global — a flam across two pads is real playing and must get
 * through.
 */
export function createNoteDebounce(windowMs: number = MIDI_DEBOUNCE_MS) {
  const lastSeen = new Map<string, number>()

  return {
    /** True when this note should be let through. */
    accept(note: number, timeStamp: number, source = ''): boolean {
      const key = `${source}:${note}`
      const previous = lastSeen.get(key)
      if (previous !== undefined && timeStamp - previous < windowMs) return false
      lastSeen.set(key, timeStamp)
      return true
    },
    reset(): void {
      lastSeen.clear()
    },
  }
}

export type NoteDebounce = ReturnType<typeof createNoteDebounce>
