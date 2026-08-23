import { describe, expect, it } from 'vitest'
import type { Voice } from '@/entities/pattern'
import { buildLaneRoles, hasNoUserLanes, isUserLane, LANE_PRESETS } from './lane-roles'

const LANES: Voice[] = ['openhat', 'hihat', 'snare', 'kick']

describe('lane assignment presets (§9.2)', () => {
  it('offers the four presets from the spec', () => {
    expect(LANE_PRESETS.map((preset) => preset.id)).toEqual([
      'everything',
      'kick-only',
      'hands-only',
      'one-limb',
    ])
  })

  it('gives the player everything by default', () => {
    const roles = buildLaneRoles('everything', LANES)
    expect(Object.values(roles).every((role) => role === 'user')).toBe(true)
  })

  it('leaves the hands to the app under "kick only"', () => {
    const roles = buildLaneRoles('kick-only', LANES)
    expect(roles).toEqual({ openhat: 'auto', hihat: 'auto', snare: 'auto', kick: 'user' })
  })

  it('leaves the kick to the app under "hands only"', () => {
    const roles = buildLaneRoles('hands-only', LANES)
    expect(roles).toEqual({ openhat: 'user', hihat: 'user', snare: 'user', kick: 'auto' })
  })

  it('layers limbs one stage at a time', () => {
    expect(buildLaneRoles('one-limb', LANES, 0)).toMatchObject({ kick: 'user', snare: 'auto' })
    expect(buildLaneRoles('one-limb', LANES, 1)).toMatchObject({ kick: 'user', snare: 'user', hihat: 'auto' })
    expect(buildLaneRoles('one-limb', LANES, 2)).toMatchObject({ kick: 'auto', snare: 'user', hihat: 'user' })
    expect(Object.values(buildLaneRoles('one-limb', LANES, 3)).every((r) => r === 'user')).toBe(true)
  })

  it('clamps a stage beyond the last one', () => {
    expect(buildLaneRoles('one-limb', LANES, 99)).toEqual(buildLaneRoles('one-limb', LANES, 3))
    expect(buildLaneRoles('one-limb', LANES, -1)).toEqual(buildLaneRoles('one-limb', LANES, 0))
  })

  it('falls back to the first preset for an unknown id', () => {
    expect(buildLaneRoles('nonsense', LANES)).toEqual(buildLaneRoles('everything', LANES))
  })

  it('reports when the player has been left nothing to play', () => {
    expect(hasNoUserLanes(buildLaneRoles('everything', LANES))).toBe(false)
    expect(hasNoUserLanes({ kick: 'auto', snare: 'auto' })).toBe(true)
  })

  it('reads a role back', () => {
    const roles = buildLaneRoles('kick-only', LANES)
    expect(isUserLane(roles, 'kick')).toBe(true)
    expect(isUserLane(roles, 'hihat')).toBe(false)
    expect(isUserLane(roles, 'ride')).toBe(false) // not in this pattern at all
  })
})
