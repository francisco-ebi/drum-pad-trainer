import { create } from 'zustand'
import {
  activeCalibrationMs,
  getPadInput,
  useDeviceStore,
  type PadStrike,
} from '@/entities/device'
import { indexPattern, stepCount, type Pattern, type Voice } from '@/entities/pattern'
import type { ExpectedHit, Judgment, TakeResult, TakeStats } from '@/entities/take'
import { audioAvailable, getAudioEngine, getTransport, primeAudio } from '@/shared/lib/runtime'
import { buildLaneRoles, LANE_PRESETS, type LaneRoles } from '../lib/lane-roles'
import { PracticeSession, type TakeInterruption } from './session'

/** Consecutive clean loops before the ladder raises the tempo (§9.2). */
export const LADDER_CLEAN_LOOPS = 2
export const LADDER_CLEAN_ACCURACY = 90
export const LADDER_BPM_STEP = 5

export type PracticeStatus = 'idle' | 'running' | 'finished'

export interface PracticeState {
  status: PracticeStatus
  pattern: Pattern | undefined

  lanePresetId: string
  laneStage: number
  laneRoles: LaneRoles
  waitMode: boolean
  strictStop: boolean
  strictHands: boolean
  metronome: boolean
  countInBars: number
  tempoLadder: boolean

  /** Live HUD state (§9.2). */
  stats: TakeStats | undefined
  lastJudgment: Judgment | undefined
  waitingFor: readonly { pad: { row: number; col: number }; voice: string }[]

  /** Tempo-ladder bookkeeping. */
  cleanLoops: number
  sessionBestBpm: number
  result: TakeResult | undefined
  /** Set when a take ended on its own — e.g. the controller vanished. */
  interruption: TakeInterruption | undefined

  prepare: (pattern: Pattern) => void
  setLanePreset: (presetId: string, stage?: number) => void
  toggleLane: (voice: Voice) => void
  setWaitMode: (on: boolean) => void
  setStrictStop: (on: boolean) => void
  setStrictHands: (on: boolean) => void
  setMetronome: (on: boolean) => void
  setCountInBars: (bars: number) => void
  setTempoLadder: (on: boolean) => void
  start: () => Promise<void>
  stop: () => void
  retry: () => Promise<void>
  clearResult: () => void
  /** Feed a strike in directly — the virtual-MIDI tool and tests (§13.3). */
  injectStrike: (strike: PadStrike) => void
}

let session: PracticeSession | undefined

export const usePracticeTake = create<PracticeState>()((set, get) => ({
  status: 'idle',
  pattern: undefined,

  lanePresetId: LANE_PRESETS[0]?.id ?? 'everything',
  laneStage: 0,
  laneRoles: {},
  waitMode: false,
  strictStop: false,
  strictHands: false,
  metronome: true,
  countInBars: 1,
  tempoLadder: false,

  stats: undefined,
  lastJudgment: undefined,
  waitingFor: [],

  cleanLoops: 0,
  sessionBestBpm: 0,
  result: undefined,
  interruption: undefined,

  prepare(pattern) {
    set({
      pattern,
      laneRoles: buildLaneRoles(get().lanePresetId, pattern.lanes, get().laneStage),
      strictHands: pattern.drill?.strictHands ?? false,
      status: 'idle',
      stats: undefined,
      lastJudgment: undefined,
      result: undefined,
      cleanLoops: 0,
    })
    if (!audioAvailable()) return
    const transport = getTransport()
    transport.configure({
      bpm: pattern.bpmDefault,
      subdivision: pattern.subdivision,
      timeSig: pattern.timeSig,
      bars: pattern.bars,
    })
    transport.setLoop(true)
    transport.setCountInBars(get().countInBars)
  },

  setLanePreset(presetId, stage = 0) {
    const pattern = get().pattern
    set({
      lanePresetId: presetId,
      laneStage: stage,
      laneRoles: pattern ? buildLaneRoles(presetId, pattern.lanes, stage) : {},
    })
  },

  toggleLane(voice) {
    const roles = { ...get().laneRoles }
    roles[voice] = roles[voice] === 'user' ? 'auto' : 'user'
    set({ laneRoles: roles, lanePresetId: 'custom' })
  },

  setWaitMode(waitMode) {
    set({ waitMode })
  },
  setStrictStop(strictStop) {
    set({ strictStop })
  },
  setStrictHands(strictHands) {
    set({ strictHands })
  },
  setMetronome(metronome) {
    set({ metronome })
  },
  setCountInBars(countInBars) {
    set({ countInBars })
    if (audioAvailable()) getTransport().setCountInBars(countInBars)
  },
  setTempoLadder(tempoLadder) {
    set({ tempoLadder, cleanLoops: 0 })
  },

  async start() {
    const state = get()
    if (!state.pattern || !audioAvailable() || state.status === 'running') return
    await primeAudio()

    const input = getPadInput()
    input.enableKeyboard(true)

    const device = useDeviceStore.getState()
    const transport = getTransport()
    transport.setCountInBars(state.countInBars)

    session = new PracticeSession(
      {
        index: indexPattern(state.pattern),
        laneRoles: state.laneRoles,
        strictHands: state.strictHands,
        // Level-1 drills forgive stray hits (§10.3).
        penalizeExtras: state.pattern.level > 1,
        leftHanded: device.leftHanded,
        calibrationMs: activeCalibrationMs(device),
        metronome: state.metronome,
        waitMode: state.waitMode,
        strictStop: state.strictStop,
      },
      {
        onUpdate: ({ stats, judgment, waitingFor }) =>
          set({ stats, lastJudgment: judgment, waitingFor }),
        onLoopComplete: (_loop, accuracy) => advanceTempoLadder(accuracy),
        onFinish: (result) => set({ result, status: 'finished' }),
        onInterrupted: (reason) => set({ interruption: reason }),
      },
      { transport, audio: getAudioEngine() },
    )

    set({
      status: 'running',
      stats: undefined,
      lastJudgment: undefined,
      result: undefined,
      interruption: undefined,
    })
    session.start(input)
  },

  stop() {
    session?.stop()
    session = undefined
  },

  async retry() {
    get().stop()
    set({ status: 'idle', result: undefined, cleanLoops: 0, interruption: undefined })
    await get().start()
  },

  clearResult() {
    set({ result: undefined, status: 'idle', interruption: undefined })
  },

  injectStrike(strike) {
    getPadInput().emitStrike(strike)
  },
}))

/**
 * Tempo ladder (§9.2): after two consecutive loops at 90 % or better, nudge
 * the tempo up by 5 BPM and keep going until the player drops one, tracking
 * the best tempo they held.
 */
function advanceTempoLadder(accuracy: number): void {
  const state = usePracticeTake.getState()
  const set = usePracticeTake.setState
  if (!state.tempoLadder || !audioAvailable()) return

  const transport = getTransport()
  if (accuracy < LADDER_CLEAN_ACCURACY) {
    set({ cleanLoops: 0 })
    return
  }

  const cleanLoops = state.cleanLoops + 1
  const best = Math.max(state.sessionBestBpm, transport.bpm)
  if (cleanLoops < LADDER_CLEAN_LOOPS) {
    set({ cleanLoops, sessionBestBpm: best })
    return
  }

  const max = state.pattern?.bpmRange[1] ?? transport.bpm
  const next = Math.min(max, transport.bpm + LADDER_BPM_STEP)
  transport.setBpm(next)
  set({ cleanLoops: 0, sessionBestBpm: Math.max(best, next) })
}

/**
 * Notes still owed, read live rather than through the store: the approach
 * rings update every frame and must not push React state 60 times a second.
 */
export function pendingExpected(): readonly ExpectedHit[] {
  return session?.pendingExpected ?? []
}

/** The audio clock the rings and the judge share (§7.3). */
export function practiceNow(): number {
  return audioAvailable() ? getAudioEngine().clock.now() : 0
}

/** Ring travel time: exactly one beat (§6.3). */
export function beatSeconds(): number {
  if (!audioAvailable()) return 0.5
  const transport = getTransport()
  return transport.secondsPerStep * (transport.subdivision / 4)
}

/** Stable empty reference — see the note on NO_MAPPING in entities/device. */
const NO_LANES: readonly Voice[] = Object.freeze([])

export function laneList(state: PracticeState): readonly Voice[] {
  return state.pattern?.lanes ?? NO_LANES
}

export function patternStepCount(state: PracticeState): number {
  return state.pattern ? stepCount(state.pattern) : 0
}
