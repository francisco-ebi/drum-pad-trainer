import {
  anchorFromOutputTimestamp,
  audioClock,
  captureAnchor,
  performanceClock,
  type Clock,
  type TimeAnchor,
} from '@/shared/lib/transport'
import { Sampler } from './sampler'
import { DEFAULT_SYNTH_BANK, renderBank, type SynthBank } from './synth-kit'

export const METRONOME_SOUND = 'click'
export const METRONOME_ACCENT_SOUND = 'clickAccent'

/** Hi-hat choke group (§7.1). */
const DEFAULT_CHOKE_GROUPS: Record<string, string> = {
  hihat: 'hats',
  openhat: 'hats',
}

export interface AudioEngineOptions {
  bank?: SynthBank
  chokeGroups?: Record<string, string>
  /** Injected in tests; defaults to the browser AudioContext. */
  createContext?: () => AudioContext
}

/**
 * Owns the AudioContext, the sampler and the metronome bus, and exposes the
 * master clock every other subsystem schedules against (§7).
 */
export class AudioEngine {
  readonly ctx: AudioContext
  readonly clock: Clock
  readonly sampler: Sampler
  private readonly bank: SynthBank
  private readonly metronomeBus: GainNode
  private readonly metronomeSampler: Sampler
  private loading: Promise<void> | undefined

  constructor({ bank = DEFAULT_SYNTH_BANK, chokeGroups = DEFAULT_CHOKE_GROUPS, createContext }: AudioEngineOptions = {}) {
    this.ctx = createContext ? createContext() : new AudioContext({ latencyHint: 'interactive' })
    this.clock = audioClock(this.ctx)
    this.bank = bank
    this.sampler = new Sampler({ ctx: this.ctx, chokeGroups })
    this.metronomeBus = this.ctx.createGain()
    this.metronomeBus.gain.value = 0.8
    this.metronomeBus.connect(this.ctx.destination)
    this.metronomeSampler = new Sampler({ ctx: this.ctx, destination: this.metronomeBus })
  }

  /** Decode/render the kit once. Idempotent. */
  ready(): Promise<void> {
    this.loading ??= renderBank(this.bank, this.ctx.sampleRate).then((buffers) => {
      this.sampler.load(buffers)
      this.metronomeSampler.load(buffers)
    })
    return this.loading
  }

  /**
   * Pair the performance and audio timelines for input judging (§8.2).
   *
   * `getOutputTimestamp()` correlates the two at the *output* — the audio time
   * of the sample currently leaving the device, and the performance time it
   * left at — which is a truer pairing than reading both clocks at the call
   * site. Not every browser implements it (or fills it in before playback has
   * begun), so a back-to-back reading is the fallback; latency calibration
   * (§8.3) absorbs the difference either way.
   */
  captureAnchor(): TimeAnchor {
    return anchorFromOutputTimestamp(this.ctx.getOutputTimestamp?.(), () =>
      captureAnchor(this.clock, performanceClock()),
    )
  }

  /** Browsers start the context suspended until a user gesture. */
  async resume(): Promise<void> {
    if (this.ctx.state === 'suspended') await this.ctx.resume()
  }

  playMetronome(time: number, accent = false): void {
    this.metronomeSampler.play(accent ? METRONOME_ACCENT_SOUND : METRONOME_SOUND, time, {
      velocity: accent ? 118 : 92,
    })
  }

  setMetronomeGain(gain: number): void {
    this.metronomeBus.gain.value = Math.max(0, gain)
  }

  setMasterGain(gain: number): void {
    this.sampler.setMasterGain(gain)
  }

  silence(): void {
    this.sampler.stopAll()
  }

  async dispose(): Promise<void> {
    this.silence()
    await this.ctx.close()
  }
}
