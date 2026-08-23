import { describe, expect, it } from 'vitest'
import { EMPTY_DEVICE_SETTINGS } from './device-record'
import { activeCalibrationMs, activeMapping, activeRecord, type DeviceStore } from './store'

/**
 * Zustand compares snapshots by reference, so a selector that builds a fresh
 * object for its empty case re-renders forever. These pin the references.
 */
/** Only the data the selectors read; the actions are irrelevant here. */
type StoreData = Pick<DeviceStore, 'devices' | 'leftHanded' | 'activeDeviceName' | 'ports' | 'connection'>

function emptyState(): StoreData {
  return {
    ...EMPTY_DEVICE_SETTINGS,
    ports: [],
    connection: 'disconnected',
    activeDeviceName: 'Keyboard',
  }
}

describe('device selectors return stable references', () => {
  it('gives the same mapping object every call when nothing is stored', () => {
    const state = emptyState()
    expect(activeMapping(state)).toBe(activeMapping(state))
    expect(activeMapping(state)).toEqual({})
  })

  it('gives the stored mapping when there is one', () => {
    const mapping = { 36: { row: 4, col: 3 } }
    const state: StoreData = {
      ...emptyState(),
      activeDeviceName: 'Pad',
      devices: { Pad: { name: 'Pad', mappingSource: 'learned', mapping } },
    }
    expect(activeMapping(state)).toBe(mapping)
    expect(activeRecord(state)?.name).toBe('Pad')
  })

  it('reports zero calibration for an unknown device', () => {
    expect(activeCalibrationMs(emptyState())).toBe(0)
  })
})
