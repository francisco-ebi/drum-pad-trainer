import { create } from 'zustand'
import { getPadInput, useDeviceStore } from '@/entities/device'
import { ALL_PADS, padKey, type PadIndex } from '@/shared/config'

export interface LearnState {
  /** Index into ALL_PADS, or -1 when the wizard is not running. */
  step: number
  /** The note just captured, echoed back so the user sees it land. */
  lastNote: number | undefined
  /** Pads captured during this run. */
  learned: string[]

  start: () => Promise<void>
  skip: () => void
  back: () => void
  cancel: () => void
}

/** The pad the wizard is asking for, or undefined when it is not running. */
export function currentPad(state: LearnState): PadIndex | undefined {
  return state.step >= 0 ? ALL_PADS[state.step] : undefined
}

let stopListening: (() => void) | undefined

/**
 * The pad-by-pad learn wizard (§4.3, a required feature): prompt for each of
 * the sixteen positions in turn and record whatever note the controller sends.
 *
 * This is what makes the app work with a controller whose note layout nobody
 * has heard of — the presets are a shortcut, not a requirement.
 */
export const useLearnMapping = create<LearnState>()((set, get) => ({
  step: -1,
  lastNote: undefined,
  learned: [],

  async start() {
    const input = getPadInput()
    await input.connect()
    stopListening?.()

    stopListening = input.on('note', (note) => {
      const state = get()
      const pad = currentPad(state)
      if (!pad) return

      const device = useDeviceStore.getState()
      // Re-running a pad replaces its notes rather than piling onto them.
      device.clearPadNotes(pad)
      device.learnNote(note.note, pad)

      const step = state.step + 1
      const learned = [...state.learned, padKey(pad)]
      if (step >= ALL_PADS.length) {
        get().cancel()
        set({ learned })
        return
      }
      set({ step, lastNote: note.note, learned })
    })

    set({ step: 0, lastNote: undefined, learned: [] })
  },

  skip() {
    const step = get().step
    if (step < 0) return
    if (step + 1 >= ALL_PADS.length) {
      get().cancel()
      return
    }
    set({ step: step + 1, lastNote: undefined })
  },

  back() {
    set({ step: Math.max(0, get().step - 1), lastNote: undefined })
  },

  cancel() {
    stopListening?.()
    stopListening = undefined
    set({ step: -1, lastNote: undefined })
  },
}))
