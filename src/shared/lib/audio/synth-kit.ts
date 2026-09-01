/**
 * A synthesised drum kit, rendered once at start-up into AudioBuffers.
 *
 * The sampler plays AudioBuffers and does not care where they came from, so
 * swapping in recorded one-shots later (§17, "keep the kit swappable behind
 * the sampler interface") is a change of loader, not of engine.
 */
export type SynthLayer =
  | {
      kind: 'membrane'
      /** Start and end of the pitch sweep, in Hz. */
      freq: number
      endFreq: number
      decay: number
      gain?: number
    }
  | {
      kind: 'noise'
      filter: BiquadFilterType
      freq: number
      q?: number
      decay: number
      /** Attack-time hold before the decay starts (crack of a snare). */
      hold?: number
      gain?: number
    }
  | {
      kind: 'metal'
      /** Fundamental; inharmonic partials are derived from `ratios`. */
      freq: number
      ratios: number[]
      highpass: number
      decay: number
      gain?: number
    }

export interface SynthSound {
  layers: SynthLayer[]
  gain?: number
}

export type SynthBank = Record<string, SynthSound>

/** Kit balance: every sound is trimmed to peak below 1.0 so summed voices
 *  cannot clip the master bus, with hats and cymbals sitting under the kick
 *  and snare the way they do on a real kit. Verified by `synth-kit.test.ts`. */

const METAL_RATIOS = [1, 1.42, 1.78, 2.31, 2.94, 3.71]

/** Default acoustic-ish kit. Ids are sound names; mapping a musical voice to a
 *  sound id is domain data and lives outside `shared`. */
export const DEFAULT_SYNTH_BANK: SynthBank = {
  kick: {
    layers: [
      { kind: 'membrane', freq: 150, endFreq: 44, decay: 0.4, gain: 1 },
      { kind: 'noise', filter: 'lowpass', freq: 2200, decay: 0.02, gain: 0.35 },
    ],
    gain: 0.85,
  },
  snare: {
    layers: [
      { kind: 'membrane', freq: 210, endFreq: 155, decay: 0.13, gain: 0.7 },
      { kind: 'noise', filter: 'highpass', freq: 1400, decay: 0.19, hold: 0.005, gain: 0.85 },
    ],
    gain: 0.5,
  },
  sidestick: {
    layers: [
      { kind: 'membrane', freq: 900, endFreq: 780, decay: 0.035, gain: 0.6 },
      { kind: 'noise', filter: 'bandpass', freq: 2400, q: 5, decay: 0.05, gain: 0.7 },
    ],
  },
  hihat: {
    layers: [{ kind: 'metal', freq: 320, ratios: METAL_RATIOS, highpass: 7800, decay: 0.06 }],
    gain: 1.2,
  },
  openhat: {
    layers: [{ kind: 'metal', freq: 320, ratios: METAL_RATIOS, highpass: 6800, decay: 0.42 }],
    gain: 1.0,
  },
  shaker: {
    // Dry granular hiss: band-passed noise, brief hold then a fast decay. Less
    // metallic than a hi-hat and higher than a snare's rattle.
    layers: [{ kind: 'noise', filter: 'bandpass', freq: 6200, q: 1.1, decay: 0.05, hold: 0.004 }],
    // Trimmed well down: a shaker runs six-plus notes a bar and is a texture
    // under the kit, not a voice on top of it.
    gain: 0.3,
  },
  ride: {
    layers: [
      { kind: 'metal', freq: 480, ratios: METAL_RATIOS, highpass: 5200, decay: 1.1, gain: 0.5 },
      { kind: 'noise', filter: 'bandpass', freq: 6200, q: 1.2, decay: 0.35, gain: 0.25 },
    ],
    gain: 1.2,
  },
  crash: {
    layers: [
      { kind: 'metal', freq: 420, ratios: METAL_RATIOS, highpass: 4200, decay: 1.6, gain: 0.5 },
      { kind: 'noise', filter: 'highpass', freq: 3800, decay: 1.4, gain: 0.4 },
    ],
    gain: 0.8,
  },
  crashDark: {
    layers: [
      { kind: 'metal', freq: 330, ratios: METAL_RATIOS, highpass: 3200, decay: 1.9, gain: 0.5 },
      { kind: 'noise', filter: 'highpass', freq: 3000, decay: 1.6, gain: 0.4 },
    ],
    gain: 0.8,
  },
  splash: {
    layers: [
      { kind: 'metal', freq: 620, ratios: METAL_RATIOS, highpass: 6000, decay: 0.7, gain: 0.5 },
      { kind: 'noise', filter: 'highpass', freq: 5200, decay: 0.6, gain: 0.35 },
    ],
    gain: 0.8,
  },
  tomLow: {
    layers: [{ kind: 'membrane', freq: 130, endFreq: 82, decay: 0.55 }],
    gain: 0.7,
  },
  tomMid: {
    layers: [{ kind: 'membrane', freq: 180, endFreq: 118, decay: 0.48 }],
    gain: 0.7,
  },
  tomHigh: {
    layers: [{ kind: 'membrane', freq: 245, endFreq: 160, decay: 0.42 }],
    gain: 0.7,
  },
  click: {
    layers: [{ kind: 'membrane', freq: 1000, endFreq: 1000, decay: 0.035, gain: 0.5 }],
    gain: 1.0,
  },
  clickAccent: {
    layers: [{ kind: 'membrane', freq: 1600, endFreq: 1600, decay: 0.045, gain: 0.6 }],
    gain: 0.8,
  },
}

function soundDuration(sound: SynthSound): number {
  return Math.max(...sound.layers.map((l) => l.decay + (l.kind === 'noise' ? (l.hold ?? 0) : 0))) + 0.05
}

function makeNoise(ctx: BaseAudioContext, seconds: number): AudioBufferSourceNode {
  const length = Math.max(1, Math.ceil(seconds * ctx.sampleRate))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  const source = ctx.createBufferSource()
  source.buffer = buffer
  return source
}

function renderLayer(ctx: OfflineAudioContext, layer: SynthLayer, out: AudioNode): void {
  const env = ctx.createGain()
  const peak = layer.gain ?? 1
  env.connect(out)

  if (layer.kind === 'membrane') {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(layer.freq, 0)
    if (layer.endFreq !== layer.freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, layer.endFreq), layer.decay)
    }
    env.gain.setValueAtTime(peak, 0)
    env.gain.exponentialRampToValueAtTime(0.0001, layer.decay)
    osc.connect(env)
    osc.start(0)
    osc.stop(layer.decay + 0.01)
    return
  }

  if (layer.kind === 'noise') {
    const hold = layer.hold ?? 0
    const source = makeNoise(ctx, layer.decay + hold + 0.01)
    const filter = ctx.createBiquadFilter()
    filter.type = layer.filter
    filter.frequency.value = layer.freq
    if (layer.q !== undefined) filter.Q.value = layer.q
    env.gain.setValueAtTime(peak, 0)
    if (hold > 0) env.gain.setValueAtTime(peak, hold)
    env.gain.exponentialRampToValueAtTime(0.0001, hold + layer.decay)
    source.connect(filter)
    filter.connect(env)
    source.start(0)
    return
  }

  // metal: a ring of square oscillators through a high-pass — the classic
  // 808-style cymbal recipe, cheap and recognisably metallic.
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = layer.highpass
  hp.connect(env)
  for (const ratio of layer.ratios) {
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.value = layer.freq * ratio
    osc.connect(hp)
    osc.start(0)
    osc.stop(layer.decay + 0.01)
  }
  env.gain.setValueAtTime(peak / layer.ratios.length, 0)
  env.gain.exponentialRampToValueAtTime(0.0001, layer.decay)
}

/** Render one sound offline into a reusable AudioBuffer. */
export async function renderSound(
  sound: SynthSound,
  sampleRate: number,
  OfflineCtor: typeof OfflineAudioContext = OfflineAudioContext,
): Promise<AudioBuffer> {
  const duration = soundDuration(sound)
  const ctx = new OfflineCtor(1, Math.ceil(duration * sampleRate), sampleRate)
  const master = ctx.createGain()
  master.gain.value = sound.gain ?? 1
  master.connect(ctx.destination)
  for (const layer of sound.layers) renderLayer(ctx, layer, master)
  return ctx.startRendering()
}

/** Render a whole bank; ids keep their names. */
export async function renderBank(
  bank: SynthBank,
  sampleRate: number,
  OfflineCtor: typeof OfflineAudioContext = OfflineAudioContext,
): Promise<Map<string, AudioBuffer>> {
  const entries = await Promise.all(
    Object.entries(bank).map(
      async ([id, sound]) => [id, await renderSound(sound, sampleRate, OfflineCtor)] as const,
    ),
  )
  return new Map(entries)
}
