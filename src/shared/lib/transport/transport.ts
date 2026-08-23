import { Emitter } from '@/shared/lib/emitter'
import { createLookaheadScheduler, type LookaheadScheduler } from '@/shared/lib/audio/scheduler'
import type { TickSource } from '@/shared/lib/audio/tick-source'
import { captureAnchor, performanceClock, type Clock, type TimeAnchor } from './clock'
import {
  isBeatStep,
  mod,
  secondsPerStep,
  stepsPerBar,
  toBarStep,
  type TimeSig,
} from './time'

export type TransportState = 'stopped' | 'playing' | 'paused'

export interface TransportConfig {
  bpm: number
  subdivision: number
  timeSig: TimeSig
  bars: number
}

/** One scheduled step, placed at an exact clock timestamp. */
export interface StepEvent {
  /** Steps since `play()`; negative during the count-in. */
  rawStep: number
  /** Step index inside the pattern (0 .. patternLength - 1). */
  patternStep: number
  /** Bar and step-within-bar of `patternStep`. */
  bar: number
  step: number
  /** Exact clock time of this step. */
  time: number
  isCountIn: boolean
  isBeat: boolean
  isBarStart: boolean
}

interface TransportEvents extends Record<string, unknown> {
  /** A fresh performance-to-audio anchor was captured (§8.2). */
  anchor: TimeAnchor
  /** A step falling inside the lookahead window — schedule audio at `time`. */
  schedule: StepEvent
  /** Transport state, tempo, loop or position changed (UI sync). */
  state: TransportState
  /** A non-looping take reached its end. */
  end: void
}

export interface TransportOptions extends TransportConfig {
  clock: Clock
  /** Seconds of lead-in between `play()` and the first step, so the first
   *  events are scheduled in the future rather than in the past. */
  startLeadSec?: number
  countInBars?: number
  /** Override the scheduler heartbeat (tests inject a fake-timer source). */
  tickSource?: TickSource
  /** The timeline input events are stamped on; defaults to `performance.now()`. */
  perfClock?: Clock
  /** Overrides how the two timelines are paired (see `AudioEngine.captureAnchor`). */
  anchorSource?: () => TimeAnchor
}

/**
 * Owns tempo, position, loop and the master clock (§7.3).
 *
 * It knows nothing about patterns, voices or drills — it moves time and says
 * which step falls when. Domain code listens for `schedule` and decides what
 * that step should sound and look like.
 */
export class Transport {
  private readonly clock: Clock
  private readonly anchorSource: () => TimeAnchor
  private readonly emitter = new Emitter<TransportEvents>()
  private readonly scheduler: LookaheadScheduler
  private readonly startLeadSec: number

  private config: TransportConfig
  private state: TransportState = 'stopped'

  /** Playback range in pattern steps, `[start, end)` — the A/B loop (§9.1). */
  private rangeStart = 0
  private rangeEnd: number
  private looping = true
  private countInBars: number

  /** raw step <-> clock anchor; re-anchored on every tempo change. */
  private anchorRaw = 0
  private anchorTime = 0
  private nextScheduleRaw = 0
  private restRaw = 0
  private pendingBpm: number | undefined
  private stopAtTime: number | undefined
  private anchor: TimeAnchor | undefined

  constructor(options: TransportOptions) {
    const {
      clock,
      startLeadSec = 0.06,
      countInBars = 0,
      tickSource,
      perfClock = performanceClock(),
      anchorSource,
      ...config
    } = options
    this.clock = clock
    this.anchorSource = anchorSource ?? (() => captureAnchor(clock, perfClock))
    this.config = config
    this.startLeadSec = startLeadSec
    this.countInBars = countInBars
    this.rangeEnd = config.bars * stepsPerBar(config.timeSig, config.subdivision)
    this.scheduler = createLookaheadScheduler({
      clock,
      tickSource,
      onWindow: (_start, end) => {
        this.pumpWindow(end)
      },
    })
  }

  // ---- introspection -----------------------------------------------------

  get bpm(): number {
    return this.pendingBpm ?? this.config.bpm
  }

  get subdivision(): number {
    return this.config.subdivision
  }

  get stepsPerBar(): number {
    return stepsPerBar(this.config.timeSig, this.config.subdivision)
  }

  get secondsPerStep(): number {
    return secondsPerStep(this.config.bpm, this.config.subdivision)
  }

  get patternLength(): number {
    return this.config.bars * this.stepsPerBar
  }

  get rangeLength(): number {
    return this.rangeEnd - this.rangeStart
  }

  get range(): [number, number] {
    return [this.rangeStart, this.rangeEnd]
  }

  get loop(): boolean {
    return this.looping
  }

  get playing(): boolean {
    return this.state === 'playing'
  }

  get transportState(): TransportState {
    return this.state
  }

  /** Continuous position in pattern steps. Reads the clock, so it is exact at
   *  the instant of the call — this is what rAF renders from (§6.4). */
  get position(): number {
    return this.rangeStart + this.wrap(Math.max(0, this.rawPosition))
  }

  /** Steps since `play()`, negative during count-in. */
  get rawPosition(): number {
    if (this.state !== 'playing') return this.restRaw
    return this.anchorRaw + (this.clock.now() - this.anchorTime) / this.secondsPerStep
  }

  /** Whole steps of count-in left, 0 once the pattern is running. */
  get countInRemaining(): number {
    const raw = this.rawPosition
    return raw < 0 ? Math.ceil(-raw) : 0
  }

  /**
   * The performance-to-audio anchor captured at `play()` (§8.2), or undefined
   * while stopped. Judging maps every input timestamp through this, so a hit
   * is compared against the audio that was actually scheduled — not against
   * when the event happened to be handled.
   */
  get timeAnchor(): TimeAnchor | undefined {
    return this.anchor
  }

  /**
   * Map a DOMHighResTimeStamp — a `MIDIMessageEvent.timeStamp` or a keyboard
   * event's — onto the audio clock (§8.2).
   *
   * While stopped there is no take to judge against, so this falls back to a
   * fresh pairing; that keeps free-play monitoring honest without pretending a
   * take-relative time exists.
   */
  perfToAudioTime(perfMs: number): number {
    const anchor = this.anchor ?? this.anchorSource()
    return anchor.audioSec + (perfMs / 1000 - anchor.perfSec)
  }

  /** Inverse of {@link perfToAudioTime}, for scheduling UI against audio time. */
  audioToPerfTime(audioSec: number): number {
    const anchor = this.anchor ?? this.anchorSource()
    return (anchor.perfSec + (audioSec - anchor.audioSec)) * 1000
  }

  /**
   * Steps since `play()` at an audio-clock time — negative during count-in,
   * unwrapped, so successive loop passes stay distinguishable.
   *
   * Tempo changes re-anchor the step timeline, so this is only meaningful for
   * times at or after the most recent tempo change.
   */
  rawPositionAtTime(audioSec: number): number {
    return this.anchorRaw + (audioSec - this.anchorTime) / this.secondsPerStep
  }

  /** Pattern-step position at an audio-clock time, wrapped into the loop range. */
  positionAtTime(audioSec: number): number {
    return this.rangeStart + this.wrap(Math.max(0, this.rawPositionAtTime(audioSec)))
  }

  /** Where an input event landed, in pattern steps (§8.2 end to end). */
  positionAtPerfTime(perfMs: number): number {
    return this.positionAtTime(this.perfToAudioTime(perfMs))
  }

  on = this.emitter.on.bind(this.emitter)

  // ---- configuration -----------------------------------------------------

  /** Re-configure for a different pattern. Stops playback. */
  configure(config: Partial<TransportConfig>): void {
    this.stop()
    this.config = { ...this.config, ...config }
    this.rangeStart = 0
    this.rangeEnd = this.patternLength
    this.pendingBpm = undefined
    this.emitter.emit('state', this.state)
  }

  /** Tempo changes apply at the next bar boundary while playing, immediately
   *  when stopped (§7.3). */
  setBpm(bpm: number): void {
    if (this.state === 'playing') {
      this.pendingBpm = bpm
    } else {
      this.config = { ...this.config, bpm }
    }
    this.emitter.emit('state', this.state)
  }

  setLoop(loop: boolean): void {
    this.looping = loop
    this.stopAtTime = undefined
    this.emitter.emit('state', this.state)
  }

  /** A/B loop range in pattern steps, `[start, end)`. */
  setRange(start: number, end: number): void {
    const lo = Math.max(0, Math.min(start, this.patternLength - 1))
    const hi = Math.min(this.patternLength, Math.max(end, lo + 1))
    this.rangeStart = lo
    this.rangeEnd = hi
    if (this.state !== 'playing') this.restRaw = 0
    this.emitter.emit('state', this.state)
  }

  resetRange(): void {
    this.setRange(0, this.patternLength)
  }

  setCountInBars(bars: number): void {
    this.countInBars = Math.max(0, Math.floor(bars))
    this.emitter.emit('state', this.state)
  }

  // ---- transport ---------------------------------------------------------

  play(): void {
    if (this.state === 'playing') return
    const resuming = this.state === 'paused'
    const startRaw = resuming ? this.restRaw : -this.countInBars * this.stepsPerBar
    this.anchorRaw = startRaw
    this.anchorTime = this.clock.now() + this.startLeadSec
    this.nextScheduleRaw = Math.ceil(startRaw - 1e-9)
    this.stopAtTime = undefined
    // Re-anchor on every start: the two clocks drift apart over a long session,
    // and a take is short enough that one anchor per take is exact enough.
    this.anchor = this.anchorSource()
    this.state = 'playing'
    this.scheduler.start()
    this.emitter.emit('state', this.state)
    if (this.anchor) this.emitter.emit('anchor', this.anchor)
  }

  pause(): void {
    if (this.state !== 'playing') return
    this.restRaw = Math.max(0, this.rawPosition)
    this.scheduler.stop()
    this.state = 'paused'
    this.emitter.emit('state', this.state)
  }

  stop(): void {
    this.scheduler.stop()
    this.restRaw = 0
    this.stopAtTime = undefined
    this.pendingBpm = undefined
    this.anchor = undefined
    this.state = 'stopped'
    this.emitter.emit('state', this.state)
  }

  toggle(): void {
    if (this.state === 'playing') this.pause()
    else this.play()
  }

  /** Park the playhead on a pattern step (transport must not be playing). */
  seekToStep(patternStep: number): void {
    if (this.state === 'playing') return
    this.restRaw = this.wrap(patternStep - this.rangeStart)
    this.emitter.emit('state', this.state)
  }

  /**
   * Step-through (§9.1): move one step and emit it as a `schedule` event at
   * "now", so the same listeners that play a step during playback preview it.
   */
  stepBy(delta: number): StepEvent | undefined {
    if (this.state === 'playing') return undefined
    const current = Math.round(this.restRaw)
    const next = this.wrap(current + delta)
    this.restRaw = next
    const event = this.buildEvent(next, this.clock.now())
    this.emitter.emit('schedule', event)
    this.emitter.emit('state', this.state)
    return event
  }

  /** Which heartbeat the scheduler ended up with (§7.3 diagnostics). */
  get tickKind(): TickSource['kind'] {
    return this.scheduler.tickKind
  }

  dispose(): void {
    this.scheduler.dispose()
    this.emitter.clear()
  }

  // ---- internals ---------------------------------------------------------

  private wrap(raw: number): number {
    const len = this.rangeLength
    if (this.looping) return mod(raw, len)
    return Math.max(0, Math.min(raw, len))
  }

  private timeOfRaw(raw: number): number {
    return this.anchorTime + (raw - this.anchorRaw) * this.secondsPerStep
  }

  private buildEvent(raw: number, time: number): StepEvent {
    const isCountIn = raw < 0
    const perBar = this.stepsPerBar
    if (isCountIn) {
      const withinBar = mod(raw, perBar)
      return {
        rawStep: raw,
        patternStep: this.rangeStart,
        bar: Math.floor(raw / perBar),
        step: withinBar,
        time,
        isCountIn: true,
        isBeat: isBeatStep(withinBar, this.config.subdivision),
        isBarStart: withinBar === 0,
      }
    }
    const patternStep = this.rangeStart + this.wrap(raw)
    const { bar, step } = toBarStep(patternStep, perBar)
    return {
      rawStep: raw,
      patternStep,
      bar,
      step,
      time,
      isCountIn: false,
      isBeat: isBeatStep(patternStep, this.config.subdivision),
      isBarStart: step === 0,
    }
  }

  /** Emit every step whose exact time falls before `windowEnd`. */
  private pumpWindow(windowEnd: number): void {
    if (this.state !== 'playing') return

    if (this.stopAtTime !== undefined && this.clock.now() >= this.stopAtTime) {
      this.stop()
      this.emitter.emit('end', undefined)
      return
    }

    // Guard against a runaway loop if the clock jumps forward.
    let budget = 1000
    while (budget-- > 0) {
      const raw = this.nextScheduleRaw
      const time = this.timeOfRaw(raw)
      if (time >= windowEnd) break

      if (!this.looping && raw >= this.rangeLength) {
        this.stopAtTime = time
        break
      }

      if (this.pendingBpm !== undefined && raw >= 0 && this.isBarBoundary(raw)) {
        // Re-anchor so the boundary keeps the time it was already scheduled
        // for; only the steps after it move.
        this.anchorRaw = raw
        this.anchorTime = time
        this.config = { ...this.config, bpm: this.pendingBpm }
        this.pendingBpm = undefined
        this.emitter.emit('state', this.state)
      }

      this.emitter.emit('schedule', this.buildEvent(raw, time))
      this.nextScheduleRaw = raw + 1
    }
  }

  private isBarBoundary(raw: number): boolean {
    if (this.wrap(raw) === 0) return true
    const patternStep = this.rangeStart + this.wrap(raw)
    return mod(patternStep, this.stepsPerBar) === 0
  }
}
