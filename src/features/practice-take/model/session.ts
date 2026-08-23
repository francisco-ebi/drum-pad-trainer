import { applyCalibration, type PadInput, type PadStrike } from '@/entities/device'
import { DYNAMICS, hitsAtStep, VOICE_META, type PatternIndex } from '@/entities/pattern'
import {
  loopAccuracy,
  summarize,
  TakeJudge,
  type Judgment,
  type TakeResult,
  type TakeStats,
} from '@/entities/take'
import type { StepEvent, Transport } from '@/shared/lib/transport'
import { expectedHitsForStep } from '../lib/expected-timeline'
import { isUserLane, type LaneRoles } from '../lib/lane-roles'

/** Consecutive misses that end a take in strict mode (§9.2). */
export const STRICT_MISS_LIMIT = 8

/** The slice of the audio engine a take needs — narrow enough to fake. */
export interface TakeAudio {
  clock: { now(): number }
  playMetronome(time: number, accent?: boolean): void
  sampler: { play(id: string, time?: number, options?: { velocity?: number }): boolean }
}

export interface TakeRuntime {
  transport: Transport
  audio: TakeAudio
}

export interface PracticeSessionConfig {
  index: PatternIndex
  /** Fixed for the take: changing lanes mid-take would invalidate the score. */
  laneRoles: LaneRoles
  strictHands: boolean
  penalizeExtras: boolean
  leftHanded: boolean
  /** Stored device latency correction in ms (§8.3). */
  calibrationMs: number
  metronome: boolean
  /** Synthesia-style step-by-step learning, no timing judgment (§9.2). */
  waitMode: boolean
  /** Stop the take after 8 consecutive misses instead of playing on (§9.2). */
  strictStop: boolean
  /** Assessed takes run a fixed number of loops (§9.3); practice runs open-ended. */
  maxLoops?: number
}

export interface PracticeUpdate {
  stats: TakeStats
  /** The judgment just made, for the HUD's floating label. */
  judgment?: Judgment
  /** Notes still owed on the current step, in wait mode. */
  waitingFor: readonly { pad: { row: number; col: number }; voice: string }[]
}

export type TakeInterruption = 'device-disconnected'

export interface PracticeSessionCallbacks {
  onUpdate: (update: PracticeUpdate) => void
  onLoopComplete: (loop: number, accuracy: number) => void
  onFinish: (result: TakeResult) => void
  /** The take ended for a reason other than the player choosing to. */
  onInterrupted?: (reason: TakeInterruption) => void
}

/**
 * One take, from count-in to results.
 *
 * It owns the judge and the subscriptions, and nothing else: tempo laddering
 * and lane presets are decisions the store makes *between* takes, because a
 * take whose rules changed halfway through cannot be scored.
 */
export class PracticeSession {
  private readonly judge: TakeJudge
  private readonly unsubscribe: (() => void)[] = []
  private frame: number | undefined
  private running = false
  private waiting: ReturnType<typeof expectedHitsForStep> = []
  private evaluatedLoop = -1
  private pendingLoopEval: { loop: number; atTime: number } | undefined
  /** Set when the take is over but hits inside their window may still land. */
  private finishAt: number | undefined

  constructor(
    private readonly config: PracticeSessionConfig,
    private readonly callbacks: PracticeSessionCallbacks,
    private readonly runtime: TakeRuntime,
  ) {
    this.judge = new TakeJudge({
      secondsPerStep: runtime.transport.secondsPerStep,
      strictHands: config.strictHands,
      penalizeExtras: config.penalizeExtras,
    })
  }

  get stats(): TakeStats {
    return this.judge.stats
  }

  get pendingExpected() {
    return this.judge.pending
  }

  start(input: PadInput): void {
    if (this.running) return
    this.running = true
    const transport = this.runtime.transport

    this.unsubscribe.push(transport.on('schedule', (event) => this.onSchedule(event)))
    this.unsubscribe.push(input.on('strike', (strike) => this.onStrike(strike)))

    // Losing the controller mid-take ends it cleanly (§16 M2), rather than
    // letting every remaining note settle into a cascade of misses. It ends
    // rather than pauses because the expected timeline is pinned to absolute
    // audio times: resuming would leave every note pointing at a moment that
    // has already gone by.
    this.unsubscribe.push(
      input.on('disconnected', () => {
        if (!this.running) return
        this.stop()
        this.callbacks.onInterrupted?.('device-disconnected')
      }),
    )

    if (this.config.waitMode) {
      // Wait mode has no clock of its own: each correct strike advances a step.
      transport.stop()
      transport.seekToStep(0)
      this.armWaitStep(0)
    } else {
      transport.play()
    }
    this.tick()
  }

  stop(): TakeResult {
    this.running = false
    if (this.frame !== undefined) cancelAnimationFrame(this.frame)
    this.frame = undefined
    for (const off of this.unsubscribe) off()
    this.unsubscribe.length = 0
    this.runtime.transport.stop()
    this.judge.settle(Infinity)
    const result = summarize(this.judge)
    this.callbacks.onFinish(result)
    return result
  }

  // ---- transport -----------------------------------------------------------

  private onSchedule(event: StepEvent): void {
    const audio = this.runtime.audio

    if (event.isCountIn) {
      if (event.isBeat) audio.playMetronome(event.time, event.step === 0)
      return
    }
    if (this.config.metronome && event.isBeat) {
      audio.playMetronome(event.time, event.step === 0)
    }

    // The app plays the lanes the player did not take (§9.2).
    for (const hit of hitsAtStep(this.config.index, event.patternStep)) {
      if (isUserLane(this.config.laneRoles, hit.voice)) continue
      const velocity = hit.accent
        ? DYNAMICS.accentVelocity
        : hit.ghost
          ? DYNAMICS.ghostVelocity
          : DYNAMICS.normalVelocity
      audio.sampler.play(VOICE_META[hit.voice].soundId, event.time, { velocity })
    }

    // Wait mode is pure sequence learning: nothing is timed, so nothing is
    // handed to the judge.
    if (this.config.waitMode) return

    const loop = this.loopOf(event.rawStep)

    // The scheduler runs ahead of the playhead, so on a fixed-length take it
    // reaches into the loop *after* the last one. Those notes are not part of
    // the take and must not be charged as misses.
    if (this.config.maxLoops !== undefined && loop >= this.config.maxLoops) return

    this.judge.expectAll(
      expectedHitsForStep(this.context(), event.patternStep, event.time, loop),
    )
  }

  private loopOf(rawStep: number): number {
    const length = this.runtime.transport.rangeLength
    return length > 0 ? Math.floor(Math.max(0, rawStep) / length) : 0
  }

  private context() {
    return {
      index: this.config.index,
      isUserLane: (voice: Parameters<typeof isUserLane>[1]) =>
        isUserLane(this.config.laneRoles, voice),
      leftHanded: this.config.leftHanded,
    }
  }

  // ---- input ---------------------------------------------------------------

  private onStrike(strike: PadStrike): void {
    // Direct monitoring (§7.2): the player's own pad sounds immediately and
    // never goes through the scheduler.
    if (strike.voice) {
      this.runtime.audio.sampler.play(VOICE_META[strike.voice].soundId, undefined, {
        velocity: strike.velocity,
      })
    }

    if (this.config.waitMode) {
      this.onWaitStrike(strike)
      return
    }

    const transport = this.runtime.transport
    const time = applyCalibration(
      transport.perfToAudioTime(strike.timeStamp),
      this.config.calibrationMs,
    )
    const judgment = this.judge.hit({
      pad: strike.pad,
      voice: strike.voice,
      velocity: strike.velocity,
      time,
    })
    this.emit(judgment)
  }

  // ---- wait mode -----------------------------------------------------------

  private armWaitStep(fromStep: number): void {
    const transport = this.runtime.transport
    const [rangeStart, rangeEnd] = transport.range
    const length = rangeEnd - rangeStart

    for (let offset = 0; offset < length; offset++) {
      const step = rangeStart + ((fromStep - rangeStart + offset) % length)
      const owed = expectedHitsForStep(this.context(), step, 0, 0)
      if (owed.length > 0) {
        transport.seekToStep(step)
        this.waiting = owed
        this.emit()
        return
      }
    }
    this.waiting = []
    this.emit()
  }

  private onWaitStrike(strike: PadStrike): void {
    const matched = this.waiting.findIndex((owed) =>
      this.config.strictHands
        ? owed.pad.row === strike.pad.row && owed.pad.col === strike.pad.col
        : owed.voice === strike.voice,
    )
    if (matched === -1) return

    this.waiting = this.waiting.filter((_, index) => index !== matched)
    if (this.waiting.length > 0) {
      this.emit()
      return
    }

    // Step forward, letting the auto lanes sound on the way.
    const transport = this.runtime.transport
    transport.stepBy(1)
    this.armWaitStep(Math.round(transport.position))
  }

  // ---- frame loop ----------------------------------------------------------

  /** How long after a note is due it can still be played and counted. */
  private get settleTailSec(): number {
    return this.judge.timingWindows.goodSec + 0.02
  }

  /**
   * One pass of settling, loop scoring and end-of-take checks.
   *
   * Separated from the frame loop so it can be driven directly: a take's
   * behaviour over time is then testable against a hand-cranked clock rather
   * than whatever `requestAnimationFrame` decides to do.
   */
  pump(now: number): void {
    if (!this.running) return
    const transport = this.runtime.transport

    const missed = this.judge.settle(now)
    if (missed.length > 0) this.emit(missed[missed.length - 1])

    if (this.finishAt !== undefined) {
      if (now >= this.finishAt) this.stop()
      return
    }

    if (this.config.strictStop && this.judge.trailingMisses >= STRICT_MISS_LIMIT) {
      this.stop()
      return
    }

    if (!this.config.waitMode) {
      const currentLoop = this.loopOf(transport.rawPosition)
      const finishedLoop = currentLoop - 1

      // Score a finished loop only once its last notes are out of their
      // window, or a hit still in time would be counted as a miss.
      if (finishedLoop > this.evaluatedLoop && this.pendingLoopEval === undefined) {
        this.pendingLoopEval = { loop: finishedLoop, atTime: now + this.settleTailSec }
      }
      if (this.pendingLoopEval !== undefined && now >= this.pendingLoopEval.atTime) {
        const { loop } = this.pendingLoopEval
        this.pendingLoopEval = undefined
        this.evaluatedLoop = loop
        this.callbacks.onLoopComplete(loop, loopAccuracy(this.judge.allJudgments, loop))
      }

      const maxLoops = this.config.maxLoops
      if (maxLoops !== undefined && currentLoop >= maxLoops) {
        // Silence the transport now, but keep judging: the last note of the
        // take is still playable for another window's width.
        transport.stop()
        this.finishAt = now + this.settleTailSec
      }
    }
  }

  private tick = (): void => {
    if (!this.running) return
    this.pump(this.runtime.audio.clock.now())
    if (this.running) this.frame = requestAnimationFrame(this.tick)
  }

  private emit(judgment?: Judgment): void {
    this.callbacks.onUpdate({
      stats: this.judge.stats,
      ...(judgment ? { judgment } : {}),
      waitingFor: this.waiting.map((hit) => ({ pad: hit.pad, voice: hit.voice })),
    })
  }
}
