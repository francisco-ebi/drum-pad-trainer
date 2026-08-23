import { hitsAtStep, VOICE_META, DYNAMICS, type PatternIndex, type Voice } from '@/entities/pattern'
import { AudioEngine } from '@/shared/lib/audio'
import { Transport, type StepEvent } from '@/shared/lib/transport'

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

let engine: AudioEngine | undefined
let transport: Transport | undefined
let snapshot: (() => PlaybackSnapshot) | undefined

export function setPlaybackSnapshot(getter: () => PlaybackSnapshot): void {
  snapshot = getter
}

export function audioAvailable(): boolean {
  return typeof AudioContext !== 'undefined'
}

export function getEngine(): AudioEngine {
  engine ??= new AudioEngine()
  return engine
}

/** Play every scheduled hit at its exact clock time (§7.2, Watch mode). */
function onSchedule(event: StepEvent): void {
  const state = snapshot?.()
  if (!state) return
  const audio = getEngine()

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

export function getTransport(): Transport {
  if (!transport) {
    transport = new Transport({
      clock: getEngine().clock,
      bpm: 80,
      subdivision: 8,
      timeSig: [4, 4],
      bars: 1,
    })
    transport.on('schedule', onSchedule)
  }
  return transport
}

/** Render the kit and lift the browser's autoplay suspension. */
export async function primeAudio(): Promise<void> {
  const audio = getEngine()
  await audio.resume()
  await audio.ready()
}

/** Test seam: drop the singletons so a fresh engine can be built. */
export function resetPlaybackEngine(): void {
  transport?.dispose()
  transport = undefined
  engine = undefined
  snapshot = undefined
}
