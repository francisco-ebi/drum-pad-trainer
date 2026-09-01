import { create } from 'zustand'
import {
  DEFAULT_PATTERN_ID,
  getPattern,
  indexPattern,
  stepCount,
  type PatternIndex,
  type Pattern,
  type Voice,
} from '@/entities/pattern'
import type { TransportState } from '@/shared/lib/transport'
import { audioAvailable, getTransport, primeAudio } from '@/shared/lib/runtime'
import { setPlaybackSnapshot } from './engine'

export interface WatchPlaybackState {
  pattern: Pattern
  index: PatternIndex
  bpm: number
  loop: boolean
  transportState: TransportState
  countInBars: number
  metronome: boolean
  /** Continuous playhead bar instead of the discrete column (§6.1). */
  smoothPlayhead: boolean
  /** Off-beat delay, 0 straight to 1 triplet. Seeded from the pattern (§7.3). */
  swing: number
  muted: Voice[]
  soloed: Voice[]
  /** A/B loop range in pattern steps, `[start, end)`. */
  range: [number, number]
  /** Kit rendered and the AudioContext running. */
  audioReady: boolean

  loadPattern: (id: string) => void
  play: () => void
  pause: () => void
  stop: () => void
  toggle: () => void
  setBpm: (bpm: number) => void
  setLoop: (loop: boolean) => void
  setMetronome: (on: boolean) => void
  setSmoothPlayhead: (on: boolean) => void
  setSwing: (amount: number) => void
  toggleMute: (voice: Voice) => void
  toggleSolo: (voice: Voice) => void
  clearMuteSolo: () => void
  setCountInBars: (bars: number) => void
  stepBy: (delta: number) => void
  seekToStep: (step: number) => void
  setRange: (start: number, end: number) => void
  resetRange: () => void
}

function requirePattern(id: string): Pattern {
  const pattern = getPattern(id)
  if (!pattern) throw new Error(`Unknown pattern: ${id}`)
  return pattern
}

const initialPattern = requirePattern(DEFAULT_PATTERN_ID)

/** Is a voice audible under the current mute/solo state (§9.1)? */
export function isVoiceAudible(state: Pick<WatchPlaybackState, 'muted' | 'soloed'>, voice: Voice): boolean {
  if (state.soloed.length > 0) return state.soloed.includes(voice)
  return !state.muted.includes(voice)
}

export const useWatchPlayback = create<WatchPlaybackState>()((set, get) => {
  const syncTransportState = () => {
    set({ transportState: getTransport().transportState, bpm: getTransport().bpm })
  }

  return {
    pattern: initialPattern,
    index: indexPattern(initialPattern),
    bpm: initialPattern.bpmDefault,
    loop: true,
    transportState: 'stopped',
    countInBars: 0,
    metronome: false,
    smoothPlayhead: false,
    swing: initialPattern.swing ?? 0,
    muted: [],
    soloed: [],
    range: [0, stepCount(initialPattern)],
    audioReady: false,

    loadPattern(id) {
      const pattern = requirePattern(id)
      const index = indexPattern(pattern)
      const total = stepCount(pattern)
      set({
        pattern,
        index,
        bpm: pattern.bpmDefault,
        swing: pattern.swing ?? 0,
        range: [0, total],
        muted: [],
        soloed: [],
        transportState: 'stopped',
      })
      if (!audioAvailable()) return
      const transport = getTransport()
      transport.configure({
        bpm: pattern.bpmDefault,
        subdivision: pattern.subdivision,
        timeSig: pattern.timeSig,
        bars: pattern.bars,
        swing: pattern.swing ?? 0,
      })
      transport.setLoop(get().loop)
      transport.setCountInBars(get().countInBars)
    },

    play() {
      if (!audioAvailable()) return
      const transport = getTransport()
      void primeAudio().then(() => {
        set({ audioReady: true })
        transport.play()
        syncTransportState()
      })
    },

    pause() {
      if (!audioAvailable()) return
      getTransport().pause()
      syncTransportState()
    },

    stop() {
      if (!audioAvailable()) return
      getTransport().stop()
      syncTransportState()
    },

    toggle() {
      if (get().transportState === 'playing') get().pause()
      else get().play()
    },

    setBpm(bpm) {
      const [min, max] = get().pattern.bpmRange
      const clamped = Math.round(Math.min(max, Math.max(min, bpm)))
      set({ bpm: clamped })
      if (audioAvailable()) getTransport().setBpm(clamped)
    },

    setLoop(loop) {
      set({ loop })
      if (audioAvailable()) getTransport().setLoop(loop)
    },

    setMetronome(metronome) {
      set({ metronome })
    },

    setSmoothPlayhead(smoothPlayhead) {
      set({ smoothPlayhead })
    },

    setSwing(amount) {
      const swing = Math.min(1, Math.max(0, amount))
      set({ swing })
      if (audioAvailable()) getTransport().setSwing(swing)
    },

    toggleMute(voice) {
      const muted = get().muted
      set({ muted: muted.includes(voice) ? muted.filter((v) => v !== voice) : [...muted, voice] })
    },

    toggleSolo(voice) {
      const soloed = get().soloed
      set({ soloed: soloed.includes(voice) ? soloed.filter((v) => v !== voice) : [...soloed, voice] })
    },

    clearMuteSolo() {
      set({ muted: [], soloed: [] })
    },

    setCountInBars(bars) {
      set({ countInBars: bars })
      if (audioAvailable()) getTransport().setCountInBars(bars)
    },

    stepBy(delta) {
      if (!audioAvailable()) return
      // Wait for the kit on the first press, so step-through is audible from
      // the very first step rather than silent until the buffers land.
      void primeAudio().then(() => {
        set({ audioReady: true })
        getTransport().stepBy(delta)
        syncTransportState()
      })
    },

    seekToStep(step) {
      if (!audioAvailable()) return
      getTransport().seekToStep(step)
      syncTransportState()
    },

    setRange(start, end) {
      set({ range: [start, end] })
      if (audioAvailable()) getTransport().setRange(start, end)
    },

    resetRange() {
      const total = stepCount(get().pattern)
      set({ range: [0, total] })
      if (audioAvailable()) getTransport().resetRange()
    },
  }
})

// The scheduler asks the store what to play, at the exact moment it schedules.
setPlaybackSnapshot(() => {
  const state = useWatchPlayback.getState()
  return {
    index: state.index,
    isAudible: (voice) => isVoiceAudible(state, voice),
    metronome: state.metronome,
  }
})
