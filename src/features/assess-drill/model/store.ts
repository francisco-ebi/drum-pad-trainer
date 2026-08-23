import { create } from 'zustand'
import { activeCalibrationMs, getPadInput, useDeviceStore } from '@/entities/device'
import {
  computeStars,
  getDrill,
  TRACK_UNLOCK_STARS,
  drillsInTrack,
  type Drill,
  type StarOutcome,
} from '@/entities/drill'
import { getPattern, indexPattern, type Pattern } from '@/entities/pattern'
import { useProgress, type RecordResult } from '@/entities/progress'
import {
  buildLaneRoles,
  PracticeSession,
  type ExpectedHit,
  type Judgment,
  type TakeResult,
  type TakeStats,
} from '@/entities/take'
import { audioAvailable, getAudioEngine, getTransport, primeAudio } from '@/shared/lib/runtime'

export type AssessStatus = 'idle' | 'running' | 'finished'

export interface AssessState {
  drill: Drill | undefined
  pattern: Pattern | undefined
  status: AssessStatus
  /** Tempo the take runs at; defaults to the drill's target (§11.1). */
  bpm: number
  stats: TakeStats | undefined
  lastJudgment: Judgment | undefined
  result: TakeResult | undefined
  stars: StarOutcome | undefined
  award: RecordResult | undefined
  interrupted: boolean

  load: (drillId: string) => void
  setBpm: (bpm: number) => void
  start: () => Promise<void>
  abandon: () => void
  retry: () => Promise<void>
  clear: () => void
}

let session: PracticeSession | undefined

/**
 * An assessed take (§9.3): a drill's pattern under the drill's fixed rules,
 * for a fixed number of loops, producing stars and a progress entry.
 *
 * The rules are read once at `start` and never touched again — a take whose
 * tempo or strictness changed halfway through could not honestly be scored.
 */
export const useAssessDrill = create<AssessState>()((set, get) => ({
  drill: undefined,
  pattern: undefined,
  status: 'idle',
  bpm: 0,
  stats: undefined,
  lastJudgment: undefined,
  result: undefined,
  stars: undefined,
  award: undefined,
  interrupted: false,

  load(drillId) {
    const drill = getDrill(drillId)
    const pattern = drill ? getPattern(drill.patternId) : undefined
    if (!drill || !pattern) {
      set({ drill: undefined, pattern: undefined, status: 'idle' })
      return
    }

    set({
      drill,
      pattern,
      bpm: drill.targetBpm,
      status: 'idle',
      stats: undefined,
      lastJudgment: undefined,
      result: undefined,
      stars: undefined,
      award: undefined,
      interrupted: false,
    })

    if (!audioAvailable()) return
    const transport = getTransport()
    transport.configure({
      bpm: drill.targetBpm,
      subdivision: pattern.subdivision,
      timeSig: pattern.timeSig,
      bars: pattern.bars,
    })
    transport.setLoop(true)
    transport.setCountInBars(1)
  },

  setBpm(bpm) {
    const pattern = get().pattern
    if (!pattern || get().status === 'running') return
    const [min, max] = pattern.bpmRange
    const clamped = Math.round(Math.min(max, Math.max(min, bpm)))
    set({ bpm: clamped })
    if (audioAvailable()) getTransport().setBpm(clamped)
  },

  async start() {
    const state = get()
    const { drill, pattern } = state
    if (!drill || !pattern || !audioAvailable() || state.status === 'running') return
    await primeAudio()

    const input = getPadInput()
    input.enableKeyboard(true)

    const device = useDeviceStore.getState()
    const transport = getTransport()
    transport.setBpm(state.bpm)
    transport.setCountInBars(1)

    session = new PracticeSession(
      {
        index: indexPattern(pattern),
        laneRoles: buildLaneRoles(drill.lanePresetId ?? 'everything', pattern.lanes),
        strictHands: drill.strictHands,
        // Level-1 drills forgive stray hits (§10.3).
        penalizeExtras: pattern.level > 1,
        leftHanded: device.leftHanded,
        calibrationMs: activeCalibrationMs(device),
        metronome: true,
        waitMode: false,
        strictStop: false,
        maxLoops: drill.loops,
      },
      {
        onUpdate: ({ stats, judgment }) => set({ stats, lastJudgment: judgment }),
        onLoopComplete: () => {},
        onFinish: (result) => finish(result),
        onInterrupted: () => set({ interrupted: true }),
      },
      { transport, audio: getAudioEngine() },
    )

    set({
      status: 'running',
      stats: undefined,
      lastJudgment: undefined,
      result: undefined,
      stars: undefined,
      award: undefined,
      interrupted: false,
    })
    session.start(input)
  },

  abandon() {
    session?.stop()
    session = undefined
  },

  async retry() {
    get().abandon()
    set({ status: 'idle', result: undefined, stars: undefined, award: undefined })
    await get().start()
  },

  clear() {
    set({ status: 'idle', result: undefined, stars: undefined, award: undefined, interrupted: false })
  },
}))

/**
 * Notes the assessed take is still waiting for — read live, so the approach
 * rings and the virtual-MIDI tool can follow a drill exactly as they follow a
 * practice take.
 */
export function pendingExpected(): readonly ExpectedHit[] {
  return session?.pendingExpected ?? []
}

/**
 * Score the finished take and commit it to progress.
 *
 * An interrupted take — the controller vanished part-way — is shown but never
 * recorded: half a take is not a result.
 */
function finish(result: TakeResult): void {
  const state = useAssessDrill.getState()
  const drill = state.drill
  session = undefined
  if (!drill) return

  const stars = computeStars(drill, result.stats.accuracy, state.bpm)
  useAssessDrill.setState({ result, stars, status: 'finished' })

  if (state.interrupted) return

  const award = useProgress.getState().record(
    {
      drillId: drill.id,
      trackId: drill.trackId,
      accuracy: result.stats.accuracy,
      score: result.stats.score,
      bpm: state.bpm,
      stars: stars.stars,
      maxCombo: result.stats.maxCombo,
      perfectCount: result.stats.counts.perfect,
      strictHands: drill.strictHands,
      at: new Date(),
    },
    {
      trackDrillIds: drillsInTrack(drill.trackId).map((entry) => entry.id),
      trackClearedStars: TRACK_UNLOCK_STARS,
    },
  )
  useAssessDrill.setState({ award })
}
