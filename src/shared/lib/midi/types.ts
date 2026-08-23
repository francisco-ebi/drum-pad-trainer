/** One note-on from a controller, before anything knows what a pad is. */
export interface NoteEvent {
  note: number
  /** 0–127, recorded on every hit for later dynamics work (§4.3). */
  velocity: number
  /** DOMHighResTimeStamp in ms — the event's own stamp, not arrival time (§8.2). */
  timeStamp: number
  /** MIDI port name, or 'keyboard' for the fallback input. */
  source: string
}

export interface MidiPort {
  id: string
  name: string
  manufacturer: string
}

export type MidiConnectionState = 'unsupported' | 'denied' | 'connected' | 'disconnected'

export interface MidiInputEvents extends Record<string, unknown> {
  note: NoteEvent
  /** Ports appeared or vanished — hot-plug (§8.1). */
  ports: MidiPort[]
  /** The selected device went away mid-session. */
  disconnected: MidiPort
  state: MidiConnectionState
}
