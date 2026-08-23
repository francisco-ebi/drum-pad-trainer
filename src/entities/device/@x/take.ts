/** Public surface of `entities/device` for `entities/take` (FSD @x
 *  cross-import notation, §13.2). A take is played *on* a device: it resolves
 *  notes to pads, corrects for that device's latency, and listens to its
 *  strikes. */
export type { PadLayout } from '../config/pad-layout'
export { resolvePad } from '../lib/resolve-pad'
export { applyCalibration } from '../lib/calibration'
export type { PadInput, PadStrike } from '../model/input'
