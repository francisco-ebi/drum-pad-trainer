import { describe, expect, it } from 'vitest'
import { createKeyboardPadInput, KEYBOARD_VELOCITY, type KeyboardPadEvent } from './keyboard'

function press(target: EventTarget, code: string, init: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', { code, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

describe('keyboard pad fallback (§3)', () => {
  it('maps the 1234 / QWER / ASDF / ZXCV block onto the grid', () => {
    const target = new EventTarget()
    const input = createKeyboardPadInput(target)
    const seen: KeyboardPadEvent[] = []
    input.on('pad', (event) => seen.push(event))
    input.start()

    // One key per row, plus both ends of the block.
    press(target, 'Digit1')
    press(target, 'Digit4')
    press(target, 'KeyR')
    press(target, 'KeyA')
    press(target, 'KeyV')

    expect(seen.map((e) => e.pad)).toEqual([
      { row: 1, col: 1 },
      { row: 1, col: 4 },
      { row: 2, col: 4 },
      { row: 3, col: 1 },
      { row: 4, col: 4 },
    ])
    expect(seen[0]?.velocity).toBe(KEYBOARD_VELOCITY)
    expect(seen[0]?.source).toBe('keyboard')
    input.stop()
  })

  it('ignores keys outside the pad block', () => {
    const target = new EventTarget()
    const input = createKeyboardPadInput(target)
    const seen: KeyboardPadEvent[] = []
    input.on('pad', (event) => seen.push(event))
    input.start()
    press(target, 'KeyP')
    press(target, 'Space')
    expect(seen).toEqual([])
    input.stop()
  })

  it('ignores auto-repeat and modified keys', () => {
    const target = new EventTarget()
    const input = createKeyboardPadInput(target)
    const seen: KeyboardPadEvent[] = []
    input.on('pad', (event) => seen.push(event))
    input.start()
    press(target, 'KeyQ', { repeat: true })
    press(target, 'KeyQ', { metaKey: true })
    press(target, 'KeyQ', { ctrlKey: true })
    expect(seen).toEqual([])
    press(target, 'KeyQ')
    expect(seen).toHaveLength(1)
    input.stop()
  })

  it('stops listening once stopped', () => {
    const target = new EventTarget()
    const input = createKeyboardPadInput(target)
    const seen: KeyboardPadEvent[] = []
    input.on('pad', (event) => seen.push(event))
    input.start()
    press(target, 'KeyZ')
    input.stop()
    press(target, 'KeyZ')
    expect(seen).toHaveLength(1)
    expect(input.running).toBe(false)
  })

  it('prevents the default action so pad keys never type into the page', () => {
    const target = new EventTarget()
    const input = createKeyboardPadInput(target)
    input.start()
    expect(press(target, 'KeyS').defaultPrevented).toBe(true)
    expect(press(target, 'KeyP').defaultPrevented).toBe(false)
    input.stop()
  })
})
