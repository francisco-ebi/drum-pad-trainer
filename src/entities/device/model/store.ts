import { create } from 'zustand'
import type { PadIndex } from '@/shared/config'
import { loadSlice, saveSlice, storageKey, type PersistedSlice } from '@/shared/lib/persist'
import type { MidiConnectionState, MidiPort } from '@/shared/lib/midi'
import type { CalibrationResult } from '../lib/calibration'
import {
  EMPTY_DEVICE_SETTINGS,
  type DeviceRecord,
  type DeviceSettings,
} from './device-record'
import { createPadInput, type PadInput } from './input'
import {
  assignNote,
  buildPreset,
  clearPad,
  type MappingPresetId,
  type NoteMapping,
} from './note-mapping'

/** Stand-in device for keyboard-only players, so they can calibrate too (§3). */
export const KEYBOARD_DEVICE_NAME = 'Keyboard'

const DEVICE_SLICE: PersistedSlice<DeviceSettings> = {
  key: storageKey('devices'),
  version: 1,
  fallback: () => EMPTY_DEVICE_SETTINGS,
}

export interface DeviceStore extends DeviceSettings {
  ports: MidiPort[]
  connection: MidiConnectionState
  selectedPortId?: string
  /** Name of the device records apply to — the MIDI port, or the keyboard. */
  activeDeviceName: string

  connect: () => Promise<void>
  selectPort: (portId: string | undefined) => void
  applyPreset: (presetId: MappingPresetId) => void
  learnNote: (note: number, pad: PadIndex) => void
  clearPadNotes: (pad: PadIndex) => void
  saveCalibration: (result: CalibrationResult) => void
  clearCalibration: () => void
  setLeftHanded: (leftHanded: boolean) => void
  forgetDevice: (name: string) => void
}

function persist(settings: DeviceSettings): void {
  saveSlice(DEVICE_SLICE, settings)
}

/** The record for a device name, created on demand with a sane default map. */
function ensureRecord(settings: DeviceSettings, name: string): DeviceRecord {
  const existing = settings.devices[name]
  if (existing) return existing
  return {
    name,
    mappingSource: 'general-midi',
    mapping: name === KEYBOARD_DEVICE_NAME ? {} : buildPreset('general-midi'),
  }
}

export const useDeviceStore = create<DeviceStore>()((set, get) => {
  const stored = loadSlice(DEVICE_SLICE)

  const update = (name: string, change: (record: DeviceRecord) => DeviceRecord) => {
    const state = get()
    const record = change(ensureRecord(state, name))
    const devices = { ...state.devices, [name]: record }
    const next: DeviceSettings = { devices, leftHanded: state.leftHanded, lastDeviceName: name }
    set(next)
    persist(next)
  }

  return {
    ...stored,
    ports: [],
    connection: 'disconnected',
    activeDeviceName: stored.lastDeviceName ?? KEYBOARD_DEVICE_NAME,

    async connect() {
      const input = getPadInput()
      input.on('ports', (ports) => set({ ports }))
      input.on('state', (connection) => set({ connection }))
      const connection = await input.connect()
      set({ connection, ports: input.ports })

      // Reconnect to the device we were last using (§8.1).
      const remembered = get().lastDeviceName
      const match = input.ports.find((port) => port.name === remembered) ?? input.ports[0]
      if (match) get().selectPort(match.id)
    },

    selectPort(portId) {
      const input = getPadInput()
      input.selectPort(portId)
      const port = input.ports.find((candidate) => candidate.id === portId)
      const name = port?.name ?? KEYBOARD_DEVICE_NAME
      set({ selectedPortId: portId, activeDeviceName: name })
      update(name, (record) => record)
    },

    applyPreset(presetId) {
      update(get().activeDeviceName, (record) => ({
        ...record,
        mappingSource: presetId,
        mapping: buildPreset(presetId),
      }))
    },

    learnNote(note, pad) {
      update(get().activeDeviceName, (record) => ({
        ...record,
        mappingSource: 'learned',
        mapping: assignNote(record.mapping, note, pad),
      }))
    },

    clearPadNotes(pad) {
      update(get().activeDeviceName, (record) => ({
        ...record,
        mapping: clearPad(record.mapping, pad),
      }))
    },

    saveCalibration(result) {
      if (!result.usable) return // §8.3: warn and retry rather than store garbage
      update(get().activeDeviceName, (record) => ({
        ...record,
        calibrationOffsetMs: result.offsetMs,
        calibrationIqrMs: result.iqrMs,
        calibratedAt: new Date().toISOString(),
      }))
    },

    clearCalibration() {
      update(get().activeDeviceName, (record) => {
        const { calibrationOffsetMs: _o, calibrationIqrMs: _i, calibratedAt: _a, ...rest } = record
        return rest
      })
    },

    setLeftHanded(leftHanded) {
      const state = get()
      const next: DeviceSettings = {
        devices: state.devices,
        leftHanded,
        ...(state.lastDeviceName ? { lastDeviceName: state.lastDeviceName } : {}),
      }
      set(next)
      persist(next)
    },

    forgetDevice(name) {
      const state = get()
      const devices = { ...state.devices }
      delete devices[name]
      const next: DeviceSettings = { devices, leftHanded: state.leftHanded }
      set(next)
      persist(next)
    },
  }
})

// ---- selectors -----------------------------------------------------------

/** Selectors read data only, so they accept any state carrying that data. */
type DeviceStoreData = Pick<DeviceStore, 'devices' | 'activeDeviceName'>

export function activeRecord(state: DeviceStoreData): DeviceRecord | undefined {
  return state.devices[state.activeDeviceName]
}

/**
 * Shared empty value. A selector must return a stable reference for an unset
 * case — building a fresh `{}` each call makes every snapshot look changed and
 * spins React into an infinite render loop.
 */
const NO_MAPPING: NoteMapping = Object.freeze({})

export function activeMapping(state: DeviceStoreData): NoteMapping {
  return activeRecord(state)?.mapping ?? NO_MAPPING
}

export function activeCalibrationMs(state: DeviceStoreData): number {
  return activeRecord(state)?.calibrationOffsetMs ?? 0
}

// ---- the input singleton -------------------------------------------------

let padInput: PadInput | undefined

/** The one live input pipeline, wired to whatever mapping is selected. */
export function getPadInput(): PadInput {
  padInput ??= createPadInput({
    getMapping: () => activeMapping(useDeviceStore.getState()),
  })
  return padInput
}

/** Test seam: drop the pipeline so a fresh one can be built. */
export function resetPadInput(): void {
  padInput?.close()
  padInput = undefined
}

export { DEVICE_SLICE }
