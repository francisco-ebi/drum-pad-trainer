import { describe, expect, it } from 'vitest'
import { DEFAULT_SYNTH_BANK } from '@/shared/lib/audio'
import { VOICES } from '../model/types'
import { VOICE_META, voiceColor } from './voices'

describe('voice metadata', () => {
  it('covers every voice', () => {
    expect(Object.keys(VOICE_META).sort()).toEqual([...VOICES].sort())
  })

  it('maps every voice to a sound the sampler bank provides', () => {
    for (const voice of VOICES) {
      expect({ voice, known: DEFAULT_SYNTH_BANK[VOICE_META[voice].soundId] !== undefined }).toEqual({
        voice,
        known: true,
      })
    }
  })

  it('gives every voice a distinct colour token and a label', () => {
    const colors = VOICES.map((v) => VOICE_META[v].colorVar)
    expect(new Set(colors).size).toBe(VOICES.length)
    expect(voiceColor('kick')).toBe('var(--c-voice-kick)')
    for (const voice of VOICES) {
      expect(VOICE_META[voice].label.length).toBeGreaterThan(0)
      expect(VOICE_META[voice].short.length).toBeGreaterThan(0)
    }
  })
})
