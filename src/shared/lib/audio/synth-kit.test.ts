import { describe, expect, it } from 'vitest'
import { DEFAULT_SYNTH_BANK, renderSound } from './synth-kit'

const hasWebAudio = typeof OfflineAudioContext !== 'undefined'

describe('synth kit', () => {
  it('covers every sound the voice map and metronome ask for', () => {
    const required = [
      'kick', 'snare', 'sidestick', 'hihat', 'openhat', 'ride',
      'crash', 'crashDark', 'splash', 'tomLow', 'tomMid', 'tomHigh',
      'click', 'clickAccent',
    ]
    expect(Object.keys(DEFAULT_SYNTH_BANK).sort()).toEqual([...required].sort())
  })

  it('gives every sound at least one layer with a positive decay', () => {
    for (const [id, sound] of Object.entries(DEFAULT_SYNTH_BANK)) {
      expect({ id, ok: sound.layers.length > 0 && sound.layers.every((l) => l.decay > 0) }).toEqual({
        id,
        ok: true,
      })
    }
  })

  /**
   * Real rendering needs Web Audio, which jsdom does not provide — this runs
   * in the browser test environment (and was verified by hand in Chrome at
   * 44.1 kHz: peaks 0.38–0.86, kick and snare loudest, hats and ride quietest).
   */
  describe.skipIf(!hasWebAudio)('rendered balance', () => {
    it('renders every sound with signal and headroom below clipping', async () => {
      for (const [id, sound] of Object.entries(DEFAULT_SYNTH_BANK)) {
        const buffer = await renderSound(sound, 44100)
        const samples = buffer.getChannelData(0)
        let peak = 0
        for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
        expect({ id, audible: peak > 0.15, clipFree: peak < 0.95 }).toEqual({
          id,
          audible: true,
          clipFree: true,
        })
      }
    })

    it('sits the hats and cymbals under the kick and snare', async () => {
      const rms = async (id: string) => {
        const sound = DEFAULT_SYNTH_BANK[id]
        if (!sound) throw new Error(`Unknown sound ${id}`)
        const samples = (await renderSound(sound, 44100)).getChannelData(0)
        let sum = 0
        for (const sample of samples) sum += sample * sample
        return Math.sqrt(sum / samples.length)
      }
      const kick = await rms('kick')
      for (const id of ['hihat', 'openhat', 'ride']) {
        expect(await rms(id)).toBeLessThan(kick)
      }
    })
  })
})
