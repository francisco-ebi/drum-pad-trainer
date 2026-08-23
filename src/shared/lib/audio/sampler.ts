/** Choke groups (§7.1): a new sound in the group silences the ringing one, as
 *  a closed hi-hat kills an open one. */
export const CHOKE_FADE_SEC = 0.03

export interface PlayOptions {
  /** MIDI velocity 0-127. Drives the gain curve. */
  velocity?: number
  /** Extra linear gain (accent / ghost trims). */
  gain?: number
}

export interface SamplerOptions {
  ctx: BaseAudioContext
  destination?: AudioNode
  /** Sound id -> choke group name. Sounds in a group cut each other off. */
  chokeGroups?: Record<string, string>
}

/** velocity -> gain, slightly concave so soft hits stay audible (§4.3). */
export function velocityGain(velocity: number): number {
  const v = Math.min(127, Math.max(0, velocity)) / 127
  return Math.pow(v, 1.6)
}

interface Ringing {
  source: AudioBufferSourceNode
  gain: GainNode
}

/**
 * Buffer-playing sampler with per-sound gain, a velocity curve and choke
 * groups. It knows nothing about drums beyond the ids it is handed.
 */
export class Sampler {
  private readonly ctx: BaseAudioContext
  private readonly master: GainNode
  private readonly buffers = new Map<string, AudioBuffer>()
  private readonly gains = new Map<string, number>()
  private readonly chokeGroups: Record<string, string>
  private readonly ringing = new Map<string, Ringing[]>()

  constructor({ ctx, destination, chokeGroups = {} }: SamplerOptions) {
    this.ctx = ctx
    this.chokeGroups = chokeGroups
    this.master = ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(destination ?? ctx.destination)
  }

  get output(): GainNode {
    return this.master
  }

  load(buffers: Map<string, AudioBuffer>): void {
    for (const [id, buffer] of buffers) this.buffers.set(id, buffer)
  }

  has(id: string): boolean {
    return this.buffers.has(id)
  }

  setMasterGain(gain: number): void {
    this.master.gain.value = Math.max(0, gain)
  }

  setSoundGain(id: string, gain: number): void {
    this.gains.set(id, Math.max(0, gain))
  }

  /**
   * Schedule `id` at an exact clock time (or now). Returns false when the
   * sound is unknown, so callers can degrade instead of throwing.
   */
  play(id: string, time?: number, { velocity = 100, gain = 1 }: PlayOptions = {}): boolean {
    const buffer = this.buffers.get(id)
    if (!buffer) return false

    const at = Math.max(time ?? this.ctx.currentTime, this.ctx.currentTime)
    const group = this.chokeGroups[id]
    if (group) this.choke(group, at)

    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const voiceGain = this.ctx.createGain()
    voiceGain.gain.value = velocityGain(velocity) * gain * (this.gains.get(id) ?? 1)
    source.connect(voiceGain)
    voiceGain.connect(this.master)
    source.start(at)

    if (group) {
      const entry: Ringing = { source, gain: voiceGain }
      const list = this.ringing.get(group) ?? []
      list.push(entry)
      this.ringing.set(group, list)
      source.onended = () => {
        const current = this.ringing.get(group)
        if (!current) return
        const index = current.indexOf(entry)
        if (index !== -1) current.splice(index, 1)
      }
    }
    return true
  }

  /** Fade out everything ringing in a choke group, starting at `time`. */
  private choke(group: string, time: number): void {
    const list = this.ringing.get(group)
    if (!list?.length) return
    for (const entry of list) {
      const g = entry.gain.gain
      g.cancelScheduledValues(time)
      g.setValueAtTime(Math.max(g.value, 0.0001), time)
      g.exponentialRampToValueAtTime(0.0001, time + CHOKE_FADE_SEC)
      try {
        entry.source.stop(time + CHOKE_FADE_SEC)
      } catch {
        // Already stopped — nothing to choke.
      }
    }
    this.ringing.set(group, [])
  }

  /** Silence everything immediately (transport stop). */
  stopAll(): void {
    for (const [group] of this.ringing) this.choke(group, this.ctx.currentTime)
  }
}
