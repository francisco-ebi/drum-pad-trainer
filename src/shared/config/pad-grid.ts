/** Geometry of the controller grid (§4.1). Pure shape — which voice sits on
 *  which pad is domain data and lives in `entities/device`. */
export const PAD_ROWS = 4
export const PAD_COLS = 4
export const PAD_COUNT = PAD_ROWS * PAD_COLS

/** A pad position, 1-based, row 1 = top row as printed on the overlay. */
export interface PadIndex {
  row: number
  col: number
}

export function padKey(pad: PadIndex): string {
  return `${pad.row}-${pad.col}`
}

export function samePad(a: PadIndex | undefined, b: PadIndex | undefined): boolean {
  return !!a && !!b && a.row === b.row && a.col === b.col
}

/** All 16 pads in reading order (row 1 col 1 first). */
export const ALL_PADS: readonly PadIndex[] = Array.from({ length: PAD_COUNT }, (_, i) => ({
  row: Math.floor(i / PAD_COLS) + 1,
  col: (i % PAD_COLS) + 1,
}))
