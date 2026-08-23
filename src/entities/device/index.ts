export { DEFAULT_PAD_LAYOUT, padsForVoice, voiceAtPad } from './config/pad-layout'
export type { PadLayout } from './config/pad-layout'
export { orderedPads, padPlaysVoice, resolvePad } from './lib/resolve-pad'
export type { ResolveOptions } from './lib/resolve-pad'

export {
  applyCalibration,
  CALIBRATION,
  computeCalibration,
  interquartileRange,
  median,
  offsetsFromClicks,
} from './lib/calibration'
export type { CalibrationResult } from './lib/calibration'

export {
  assignNote,
  buildPreset,
  clearPad,
  CHROMATIC_BASE_NOTE,
  MAPPING_PRESETS,
  noteToPad,
  notesForPad,
  unmappedPads,
} from './model/note-mapping'
export type { MappingPreset, MappingPresetId, NoteMapping } from './model/note-mapping'

export { calibrationOf, EMPTY_DEVICE_SETTINGS, isCalibrated } from './model/device-record'
export type { DeviceRecord, DeviceSettings } from './model/device-record'

export { createPadInput } from './model/input'
export type { PadInput, PadInputOptions, PadStrike } from './model/input'

export {
  activeCalibrationMs,
  activeMapping,
  activeRecord,
  DEVICE_SLICE,
  getPadInput,
  KEYBOARD_DEVICE_NAME,
  resetPadInput,
  useDeviceStore,
} from './model/store'
export type { DeviceStore } from './model/store'
