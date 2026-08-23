import { create } from 'zustand'
import {
  CALIBRATION,
  computeCalibration,
  getPadInput,
  offsetsFromClicks,
  useDeviceStore,
  type CalibrationResult,
} from '@/entities/device'
import { audioAvailable, getAudioEngine, primeAudio } from '@/shared/lib/runtime'

/** Steady quarter notes for the click-along run (§8.3). */
export const CALIBRATION_BPM = 100
const CLICK_INTERVAL_SEC = 60 / CALIBRATION_BPM
/** Lead-in before the first click, so the run does not start under the finger. */
const LEAD_IN_SEC = 0.6

export type CalibrationStatus = 'idle' | 'running' | 'done'

export interface CalibrationState {
  status: CalibrationStatus
  /** Clicks elapsed so far, for the progress read-out. */
  progress: number
  hitCount: number
  result: CalibrationResult | undefined

  start: () => Promise<void>
  cancel: () => void
  save: () => void
}

interface Run {
  clickTimes: number[]
  hitTimes: number[]
  stop: () => void
}

let run: Run | undefined

export const useCalibration = create<CalibrationState>()((set, get) => ({
  status: 'idle',
  progress: 0,
  hitCount: 0,
  result: undefined,

  async start() {
    if (!audioAvailable() || get().status === 'running') return
    await primeAudio()

    const audio = getAudioEngine()
    const input = getPadInput()
    input.enableKeyboard(true)

    // One anchor for the whole run: every hit is mapped through the same
    // pairing, so a drift between the clocks cannot masquerade as latency.
    const anchor = audio.captureAnchor()
    const toAudioSec = (perfMs: number) => anchor.audioSec + (perfMs / 1000 - anchor.perfSec)

    const startTime = audio.clock.now() + LEAD_IN_SEC
    const clickTimes: number[] = []
    for (let i = 0; i < CALIBRATION.clicks; i++) {
      const time = startTime + i * CLICK_INTERVAL_SEC
      clickTimes.push(time)
      audio.playMetronome(time, i % 4 === 0)
    }

    const hitTimes: number[] = []
    const offStrike = input.on('strike', (strike) => {
      hitTimes.push(toAudioSec(strike.timeStamp))
      set({ hitCount: hitTimes.length })
    })

    const progressTimer = setInterval(() => {
      const elapsed = audio.clock.now() - startTime
      set({ progress: Math.max(0, Math.min(CALIBRATION.clicks, Math.floor(elapsed / CLICK_INTERVAL_SEC) + 1)) })
    }, 100)

    const finishTimer = setTimeout(
      () => get().cancel(),
      (LEAD_IN_SEC + CALIBRATION.clicks * CLICK_INTERVAL_SEC + 0.4) * 1000,
    )

    run = {
      clickTimes,
      hitTimes,
      stop: () => {
        offStrike()
        clearInterval(progressTimer)
        clearTimeout(finishTimer)
      },
    }
    set({ status: 'running', progress: 0, hitCount: 0, result: undefined })
  },

  cancel() {
    const current = run
    run = undefined
    if (!current) {
      set({ status: 'idle' })
      return
    }
    current.stop()
    const offsets = offsetsFromClicks(current.hitTimes, current.clickTimes)
    set({ status: 'done', result: computeCalibration(offsets) })
  },

  save() {
    const result = get().result
    if (!result?.usable) return
    useDeviceStore.getState().saveCalibration(result)
    set({ status: 'idle', result: undefined, progress: 0, hitCount: 0 })
  },
}))
