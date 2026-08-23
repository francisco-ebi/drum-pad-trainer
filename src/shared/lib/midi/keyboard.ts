import { Emitter } from '@/shared/lib/emitter'
import { padForKeyCode, type PadIndex } from '@/shared/config'

export interface KeyboardPadEvent {
  pad: PadIndex
  /** Keyboards have no velocity; a fixed mid-hard value stands in. */
  velocity: number
  timeStamp: number
  source: 'keyboard'
}

interface KeyboardEvents extends Record<string, unknown> {
  pad: KeyboardPadEvent
}

export const KEYBOARD_VELOCITY = 100

export interface KeyboardPadInput {
  on: Emitter<KeyboardEvents>['on']
  start(): void
  stop(): void
  readonly running: boolean
}

/**
 * Keyboard fallback for the 4x4 grid (§3): `1234 / QWER / ASDF / ZXCV`.
 *
 * It keeps every mode usable without hardware and is what lets the app be
 * driven by automated tests. Unlike MIDI it yields pads directly — there is no
 * device mapping to resolve.
 */
export function createKeyboardPadInput(target: EventTarget = window): KeyboardPadInput {
  const emitter = new Emitter<KeyboardEvents>()
  let running = false

  const onKeyDown = (event: Event) => {
    const keyEvent = event as KeyboardEvent
    // Auto-repeat is the key being held, not a second strike.
    if (keyEvent.repeat || keyEvent.metaKey || keyEvent.ctrlKey || keyEvent.altKey) return
    const node = keyEvent.target as HTMLElement | null
    if (node && ['INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName)) return

    const pad = padForKeyCode(keyEvent.code)
    if (!pad) return
    keyEvent.preventDefault()
    emitter.emit('pad', {
      pad,
      velocity: KEYBOARD_VELOCITY,
      timeStamp: keyEvent.timeStamp,
      source: 'keyboard',
    })
  }

  return {
    on: emitter.on.bind(emitter),
    start() {
      if (running) return
      running = true
      target.addEventListener('keydown', onKeyDown)
    },
    stop() {
      if (!running) return
      running = false
      target.removeEventListener('keydown', onKeyDown)
    },
    get running() {
      return running
    },
  }
}
