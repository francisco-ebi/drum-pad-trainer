import type { Voice } from '@/entities/pattern'

/** Each lane is either played by the user or by the app (§9.2). */
export type LaneRole = 'user' | 'auto'
export type LaneRoles = Record<string, LaneRole>

export interface LanePreset {
  id: string
  label: string
  description: string
  /** Presets that build up over several stages report how many they have. */
  stages?: number
  build: (lanes: readonly Voice[], stage: number) => LaneRoles
}

const HAND_VOICES: readonly Voice[] = [
  'hihat',
  'openhat',
  'ride',
  'snare',
  'sidestick',
  'cymbalA',
  'cymbalB',
  'cymbalC',
  'tomLow',
  'tomMid',
  'tomHigh',
]

function assign(lanes: readonly Voice[], isUser: (voice: Voice) => boolean): LaneRoles {
  const roles: LaneRoles = {}
  for (const lane of lanes) roles[lane] = isUser(lane) ? 'user' : 'auto'
  return roles
}

/**
 * "Add one limb at a time": kick, then the backbeat, then the hands, then
 * everything — the order a teacher layers a groove in.
 */
const LIMB_STAGES: readonly ((voice: Voice) => boolean)[] = [
  (voice) => voice === 'kick',
  (voice) => voice === 'kick' || voice === 'snare',
  (voice) => voice !== 'kick',
  () => true,
]

export const LANE_PRESETS: readonly LanePreset[] = [
  {
    id: 'everything',
    label: 'Everything',
    description: 'Play the whole groove yourself.',
    build: (lanes) => assign(lanes, () => true),
  },
  {
    id: 'kick-only',
    label: 'Kick only',
    description: 'The app plays the hands; you place the kick.',
    build: (lanes) => assign(lanes, (voice) => voice === 'kick'),
  },
  {
    id: 'hands-only',
    label: 'Hands only',
    description: 'Hats and snare are yours; the kick keeps itself.',
    build: (lanes) => assign(lanes, (voice) => HAND_VOICES.includes(voice)),
  },
  {
    id: 'one-limb',
    label: 'Add one limb at a time',
    description: 'Kick, then backbeat, then hands, then the lot.',
    stages: LIMB_STAGES.length,
    build: (lanes, stage) => {
      const test = LIMB_STAGES[Math.min(Math.max(stage, 0), LIMB_STAGES.length - 1)]
      return assign(lanes, test ?? (() => true))
    },
  },
]

export function buildLaneRoles(presetId: string, lanes: readonly Voice[], stage = 0): LaneRoles {
  const preset = LANE_PRESETS.find((candidate) => candidate.id === presetId) ?? LANE_PRESETS[0]
  if (!preset) return {}
  return preset.build(lanes, stage)
}

export function isUserLane(roles: LaneRoles, voice: Voice): boolean {
  return roles[voice] === 'user'
}

/** True when no lane is left for the player — nothing to judge. */
export function hasNoUserLanes(roles: LaneRoles): boolean {
  return !Object.values(roles).includes('user')
}
