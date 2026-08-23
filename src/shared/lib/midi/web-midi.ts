import { Emitter } from '@/shared/lib/emitter'
import { createNoteDebounce } from './debounce'
import type { MidiConnectionState, MidiInputEvents, MidiPort } from './types'

const NOTE_ON = 0x90
const NOTE_OFF = 0x80
const STATUS_MASK = 0xf0

export function midiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'
}

export interface MidiInput {
  on: Emitter<MidiInputEvents>['on']
  readonly state: MidiConnectionState
  readonly ports: MidiPort[]
  /** Port id of the device currently being listened to. */
  readonly selectedId: string | undefined
  /** Listen to one port; pass undefined to listen to none. */
  select(portId: string | undefined): void
  close(): void
}

function toPort(input: MIDIInput): MidiPort {
  return {
    id: input.id,
    name: input.name ?? 'Unknown device',
    manufacturer: input.manufacturer ?? '',
  }
}

/**
 * Web MIDI wrapper (§8.1): device list, hot-plug, note-on extraction and the
 * 30 ms same-note debounce. It knows nothing about pads, voices or patterns —
 * it turns a controller into a stream of stamped notes.
 *
 * Access is requested by the caller, on first entry to a playing screen and
 * never on landing (§17).
 */
export async function openMidiInput(): Promise<MidiInput> {
  const emitter = new Emitter<MidiInputEvents>()
  const debounce = createNoteDebounce()
  let state: MidiConnectionState = 'unsupported'
  let access: MIDIAccess | undefined
  let selectedId: string | undefined
  let listening: MIDIInput | undefined

  const listPorts = (): MidiPort[] => (access ? [...access.inputs.values()].map(toPort) : [])

  const onMessage = (event: MIDIMessageEvent) => {
    const data = event.data
    if (!data || data.length < 3) return
    const status = (data[0] ?? 0) & STATUS_MASK
    const note = data[1] ?? 0
    const velocity = data[2] ?? 0

    // Note-off, and note-on with velocity 0, are both releases (§8.1).
    if (status === NOTE_OFF || status !== NOTE_ON || velocity === 0) return
    const source = listening?.name ?? 'midi'
    if (!debounce.accept(note, event.timeStamp, source)) return

    emitter.emit('note', { note, velocity, timeStamp: event.timeStamp, source })
  }

  const detach = () => {
    if (!listening) return
    listening.removeEventListener('midimessage', onMessage as EventListener)
    listening = undefined
  }

  const select = (portId: string | undefined) => {
    detach()
    selectedId = portId
    debounce.reset()
    if (!access || portId === undefined) return
    const port = access.inputs.get(portId)
    if (!port) return
    listening = port
    port.addEventListener('midimessage', onMessage as EventListener)
    state = 'connected'
    emitter.emit('state', state)
  }

  if (!midiSupported()) {
    return {
      on: emitter.on.bind(emitter),
      get state() {
        return state
      },
      get ports() {
        return []
      },
      get selectedId() {
        return undefined
      },
      select: () => {},
      close: () => emitter.clear(),
    }
  }

  try {
    access = await navigator.requestMIDIAccess({ sysex: false })
    state = 'connected'
  } catch {
    state = 'denied'
    emitter.emit('state', state)
    return {
      on: emitter.on.bind(emitter),
      get state() {
        return state
      },
      get ports() {
        return []
      },
      get selectedId() {
        return undefined
      },
      select: () => {},
      close: () => emitter.clear(),
    }
  }

  access.addEventListener('statechange', () => {
    emitter.emit('ports', listPorts())
    if (selectedId === undefined) return
    const stillThere = access?.inputs.get(selectedId)
    if (stillThere) {
      // Re-attach: a reconnected port is a new object on some platforms.
      if (stillThere !== listening) select(selectedId)
      return
    }
    const lost = listening ? toPort(listening) : undefined
    detach()
    state = 'disconnected'
    emitter.emit('state', state)
    if (lost) emitter.emit('disconnected', lost)
  })

  return {
    on: emitter.on.bind(emitter),
    get state() {
      return state
    },
    get ports() {
      return listPorts()
    },
    get selectedId() {
      return selectedId
    },
    select,
    close() {
      detach()
      emitter.clear()
    },
  }
}
