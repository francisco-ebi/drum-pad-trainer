import type { MappingPresetId, NoteMapping } from './note-mapping'

/**
 * What is remembered about one controller, keyed by its MIDI device name so it
 * is picked up again on reconnect (§4.3, §8.1).
 */
export interface DeviceRecord {
  /** MIDI port name — stable across reconnects, unlike the port id. */
  name: string
  /** Where the mapping came from: a preset, or a learn-wizard run. */
  mappingSource: MappingPresetId | 'learned'
  mapping: NoteMapping
  /** Stored latency correction in ms, or undefined until calibrated (§8.3). */
  calibrationOffsetMs?: number
  /** Spread of the calibration run that produced the offset. */
  calibrationIqrMs?: number
  /** ISO timestamp of the last calibration run. */
  calibratedAt?: string
}

export interface DeviceSettings {
  /** Device records by MIDI port name. */
  devices: Record<string, DeviceRecord>
  /** Name of the device to reconnect to. */
  lastDeviceName?: string
  /** Swaps the lead/alternate hand convention globally (§4.2). */
  leftHanded: boolean
}

export const EMPTY_DEVICE_SETTINGS: DeviceSettings = {
  devices: {},
  leftHanded: false,
}

export function calibrationOf(record: DeviceRecord | undefined): number {
  return record?.calibrationOffsetMs ?? 0
}

export function isCalibrated(record: DeviceRecord | undefined): boolean {
  return record?.calibrationOffsetMs !== undefined
}
