import type { Voice } from '@/entities/pattern/@x/device'
import type { PadIndex } from '@/shared/config'
import { Emitter } from '@/shared/lib/emitter'
import {
  createKeyboardPadInput,
  midiSupported,
  openMidiInput,
  type MidiConnectionState,
  type MidiInput,
  type MidiPort,
  type NoteEvent,
} from '@/shared/lib/midi'
import { DEFAULT_PAD_LAYOUT, voiceAtPad, type PadLayout } from '../config/pad-layout'
import { noteToPad, type NoteMapping } from './note-mapping'

/** A strike resolved to a place on the grid — what practice and drills judge. */
export interface PadStrike {
  pad: PadIndex
  /** The voice under that pad, or undefined if the pad maps to nothing. */
  voice: Voice | undefined
  velocity: number
  /** DOMHighResTimeStamp in ms, raw — calibration is applied by the judge (§8.3). */
  timeStamp: number
  source: 'midi' | 'keyboard'
  /** The note that produced it, when it came from a controller. */
  note?: number
}

interface PadInputEvents extends Record<string, unknown> {
  strike: PadStrike
  /** Raw notes, mapped or not — the learn wizard listens here (§4.3). */
  note: NoteEvent
  ports: MidiPort[]
  state: MidiConnectionState
  disconnected: MidiPort
}

export interface PadInputOptions {
  /** Current note→pad mapping for the selected device. */
  getMapping: () => NoteMapping
  getLayout?: () => PadLayout
  /** Keyboard fallback target; defaults to the window. */
  keyboardTarget?: EventTarget
}

export interface PadInput {
  on: Emitter<PadInputEvents>['on']
  /** Request MIDI access. Called on entry to a playing screen, never on
   *  landing (§17), because that is when the browser prompts. */
  connect(): Promise<MidiConnectionState>
  selectPort(portId: string | undefined): void
  /** The keyboard fallback runs alongside MIDI, so hardware is never required. */
  enableKeyboard(enabled: boolean): void
  /** Inject a strike directly — the virtual-MIDI dev tool and tests (§13.3). */
  emitStrike(strike: PadStrike): void
  readonly ports: MidiPort[]
  readonly state: MidiConnectionState
  readonly selectedPortId: string | undefined
  close(): void
}

/**
 * The live input pipeline: raw notes in, resolved pad strikes out.
 *
 * It sits in `entities/device` because resolving a note to a pad *is* the
 * device's job — `shared/lib/midi` deliberately knows nothing about grids, and
 * the features that consume strikes (practice, calibration, the learn wizard)
 * must not each re-implement the mapping.
 */
export function createPadInput({
  getMapping,
  getLayout = () => DEFAULT_PAD_LAYOUT,
  keyboardTarget,
}: PadInputOptions): PadInput {
  const emitter = new Emitter<PadInputEvents>()
  const keyboard = createKeyboardPadInput(keyboardTarget)
  let midi: MidiInput | undefined
  let state: MidiConnectionState = midiSupported() ? 'disconnected' : 'unsupported'

  const strike = (partial: Omit<PadStrike, 'voice'>): void => {
    emitter.emit('strike', { ...partial, voice: voiceAtPad(partial.pad, getLayout()) })
  }

  keyboard.on('pad', (event) => {
    strike({
      pad: event.pad,
      velocity: event.velocity,
      timeStamp: event.timeStamp,
      source: 'keyboard',
    })
  })

  return {
    on: emitter.on.bind(emitter),

    async connect() {
      if (midi) return state
      midi = await openMidiInput()
      state = midi.state
      midi.on('note', (note) => {
        emitter.emit('note', note)
        const pad = noteToPad(getMapping(), note.note)
        if (!pad) return // unmapped note: the learn wizard still saw it
        strike({
          pad,
          velocity: note.velocity,
          timeStamp: note.timeStamp,
          source: 'midi',
          note: note.note,
        })
      })
      midi.on('ports', (ports) => emitter.emit('ports', ports))
      midi.on('disconnected', (port) => emitter.emit('disconnected', port))
      midi.on('state', (next) => {
        state = next
        emitter.emit('state', next)
      })
      emitter.emit('state', state)
      emitter.emit('ports', midi.ports)
      return state
    },

    selectPort(portId) {
      midi?.select(portId)
    },

    enableKeyboard(enabled) {
      if (enabled) keyboard.start()
      else keyboard.stop()
    },

    emitStrike(value) {
      emitter.emit('strike', value)
    },

    get ports() {
      return midi?.ports ?? []
    },
    get state() {
      return state
    },
    get selectedPortId() {
      return midi?.selectedId
    },

    close() {
      keyboard.stop()
      midi?.close()
      midi = undefined
      emitter.clear()
    },
  }
}
