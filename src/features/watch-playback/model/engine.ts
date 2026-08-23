import { hitsAtStep, VOICE_META, DYNAMICS, type PatternIndex, type Voice } from '@/entities/pattern'
import { getAudioEngine, getTransport } from '@/shared/lib/runtime'
import type { StepEvent } from '@/shared/lib/transport'

/**
 * What the scheduler needs to know at the moment a step is placed. The store
 * supplies it through a getter so this module never imports the store —
 * keeping the audio wiring free of React and free of import cycles.
 */
export interface PlaybackSnapshot {
  index: PatternIndex
  /** Voices that should sound, after mute/solo (§9.1). */
  isAudible: (voice: Voice) => boolean
  metronome: boolean
}

let snapshot: (() => PlaybackSnapshot) | undefined
let disconnect: (() => void) | undefined

export function setPlaybackSnapshot(getter: () => PlaybackSnapshot): void {
  snapshot = getter
}

/** Play every scheduled hit at its exact clock time (§7.2, Watch mode). */
function onSchedule(event: StepEvent): void {
  const state = snapshot?.()
  if (!state) return
  const audio = getAudioEngine()

  if (event.isCountIn) {
    if (event.isBeat) audio.playMetronome(event.time, event.step === 0)
    return
  }
  if (state.metronome && event.isBeat) {
    audio.playMetronome(event.time, event.step === 0)
  }

  for (const hit of hitsAtStep(state.index, event.patternStep)) {
    if (!state.isAudible(hit.voice)) continue
    const velocity = hit.accent
      ? DYNAMICS.accentVelocity
      : hit.ghost
        ? DYNAMICS.ghostVelocity
        : DYNAMICS.normalVelocity
    audio.sampler.play(VOICE_META[hit.voice].soundId, event.time, { velocity })
  }
}

/**
 * Take over the transport's step events for Watch mode.
 *
 * Modes attach and detach rather than coexisting: Practice plays only the
 * lanes assigned to "auto" (§9.2), so if both were subscribed at once every
 * auto lane would sound twice.
 */
export function connectWatchPlayback(): () => void {
  disconnectWatchPlayback()
  disconnect = getTransport().on('schedule', onSchedule)
  return disconnectWatchPlayback
}

export function disconnectWatchPlayback(): void {
  disconnect?.()
  disconnect = undefined
}

export { audioAvailable, getAudioEngine as getEngine, getTransport, primeAudio } from '@/shared/lib/runtime'
