import type { Voice } from '../model/types'

export interface VoiceMeta {
  id: Voice
  /** Full name for lane labels and the pad overlay. */
  label: string
  /** Compact label for tight grids. */
  short: string
  /** CSS custom property holding this voice's colour (§6.1). */
  colorVar: string
  /** Sound id in the sampler bank. */
  soundId: string
}

/** Voice identity is colour **plus** label everywhere (§15 colour-blind safety). */
export const VOICE_META: Record<Voice, VoiceMeta> = {
  kick: { id: 'kick', label: 'Kick', short: 'K', colorVar: '--c-voice-kick', soundId: 'kick' },
  snare: { id: 'snare', label: 'Snare', short: 'S', colorVar: '--c-voice-snare', soundId: 'snare' },
  sidestick: {
    id: 'sidestick',
    label: 'Sidestick',
    short: 'X',
    colorVar: '--c-voice-sidestick',
    soundId: 'sidestick',
  },
  hihat: { id: 'hihat', label: 'Hi Hat', short: 'H', colorVar: '--c-voice-hihat', soundId: 'hihat' },
  openhat: {
    id: 'openhat',
    label: 'Open HH',
    short: 'O',
    colorVar: '--c-voice-openhat',
    soundId: 'openhat',
  },
  ride: { id: 'ride', label: 'Ride', short: 'R', colorVar: '--c-voice-ride', soundId: 'ride' },
  cymbalA: {
    id: 'cymbalA',
    label: 'Cymbal A',
    short: 'C1',
    colorVar: '--c-voice-cymbalA',
    soundId: 'crash',
  },
  cymbalB: {
    id: 'cymbalB',
    label: 'Cymbal B',
    short: 'C2',
    colorVar: '--c-voice-cymbalB',
    soundId: 'crashDark',
  },
  cymbalC: {
    id: 'cymbalC',
    label: 'Cymbal C',
    short: 'C3',
    colorVar: '--c-voice-cymbalC',
    soundId: 'splash',
  },
  tomLow: {
    id: 'tomLow',
    label: 'Low Tom',
    short: 'T1',
    colorVar: '--c-voice-tomLow',
    soundId: 'tomLow',
  },
  tomMid: {
    id: 'tomMid',
    label: 'Mid Tom',
    short: 'T2',
    colorVar: '--c-voice-tomMid',
    soundId: 'tomMid',
  },
  tomHigh: {
    id: 'tomHigh',
    label: 'High Tom',
    short: 'T3',
    colorVar: '--c-voice-tomHigh',
    soundId: 'tomHigh',
  },
}

export function voiceColor(voice: Voice): string {
  return `var(${VOICE_META[voice].colorVar})`
}

/** Accent and ghost gain trims (§5, §7.1). */
export const DYNAMICS = {
  accentVelocity: 118,
  normalVelocity: 100,
  ghostVelocity: 52,
} as const
