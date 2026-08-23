import type { PadIndex } from './pad-grid'

/** Keyboard fallback for the 4x4 grid (§3): 1234 / QWER / ASDF / ZXCV,
 *  top row to bottom row. Keys are `KeyboardEvent.code` values so the map is
 *  independent of layout-dependent `key` values. */
export const KEYBOARD_PAD_CODES: readonly (readonly string[])[] = [
  ['Digit1', 'Digit2', 'Digit3', 'Digit4'],
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV'],
]

/** `KeyboardEvent.code` -> 1-based (row, col) pad position, or undefined. */
export function padForKeyCode(code: string): PadIndex | undefined {
  for (let r = 0; r < KEYBOARD_PAD_CODES.length; r++) {
    const row = KEYBOARD_PAD_CODES[r]
    if (!row) continue
    const c = row.indexOf(code)
    if (c !== -1) return { row: r + 1, col: c + 1 }
  }
  return undefined
}
