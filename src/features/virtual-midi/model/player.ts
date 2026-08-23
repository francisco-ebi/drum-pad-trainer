import type { PadInput } from '@/entities/device'
import type { ExpectedHit } from '@/entities/take'
import { defaultTickSource, type TickSource } from '@/shared/lib/audio'
import type { Transport } from '@/shared/lib/transport'
import { scriptTake, type PlayStyle, type ScriptedStrike } from '../lib/script'

export interface VirtualPlayerOptions {
  input: PadInput
  transport: Transport
  clock: { now(): number }
  onDone?: () => void
  /** Override the emitter's pulse; tests inject a fake-timer source. */
  tickSource?: TickSource
  intervalMs?: number
}

export interface FollowOptions {
  /** The notes the judge is currently waiting for. */
  getPending: () => readonly ExpectedHit[]
  style: PlayStyle
  random?: () => number
}

export interface VirtualPlayer {
  play(strikes: readonly ScriptedStrike[]): void
  /**
   * Play whatever the live take asks for, as it asks for it.
   *
   * Scripting against the session's own expected notes rather than a
   * separately computed timeline is what keeps the tool honest: there is no
   * second idea of when the take starts that could drift from the first.
   */
  follow(options: FollowOptions): void
  stop(): void
  readonly running: boolean
}

/**
 * Replays a scripted take into the live input pipeline (§13.3).
 *
 * Delivery rides on `requestAnimationFrame`, but each strike carries the exact
 * performance timestamp it was scripted for — so a frame of delivery jitter
 * cannot skew what the judge sees. That is what makes a scripted "+20 ms take"
 * mean precisely +20 ms.
 */
export function createVirtualPlayer({
  input,
  transport,
  clock,
  onDone,
  tickSource,
  intervalMs = 10,
}: VirtualPlayerOptions): VirtualPlayer {
  // A timer, not `requestAnimationFrame`: this emits input, it does not draw.
  // Frames stop in a background tab; a scripted take should not.
  const ticker = tickSource ?? defaultTickSource()
  let queue: ScriptedStrike[] = []
  let index = 0
  let running = false
  let following: FollowOptions | undefined
  const scripted = new Set<string>()

  const absorbPending = () => {
    if (!following) return
    const fresh = following.getPending().filter((hit) => !scripted.has(hit.id))
    if (fresh.length === 0) return
    for (const hit of fresh) scripted.add(hit.id)
    queue.push(...scriptTake(fresh, following.style, following.random))
    queue.sort((a, b) => a.time - b.time)
    // Anything already past is dropped rather than fired late in a burst.
    while (index < queue.length && (queue[index]?.time ?? 0) < clock.now() - 0.25) index += 1
  }

  const pump = () => {
    absorbPending()
    const now = clock.now()
    while (index < queue.length) {
      const strike = queue[index]
      if (!strike || strike.time > now) break
      index += 1
      input.emitStrike({
        pad: strike.pad,
        voice: strike.voice,
        velocity: strike.velocity,
        // The scripted moment, not the moment we got round to sending it.
        timeStamp: transport.audioToPerfTime(strike.time),
        source: 'midi',
      })
    }
    if (index >= queue.length && !following) {
      ticker.stop()
      running = false
      onDone?.()
    }
  }

  return {
    play(strikes) {
      following = undefined
      scripted.clear()
      queue = [...strikes].sort((a, b) => a.time - b.time)
      index = 0
      running = true
      ticker.start(intervalMs, pump)
      pump()
    },
    follow(options) {
      following = options
      scripted.clear()
      queue = []
      index = 0
      running = true
      ticker.start(intervalMs, pump)
      pump()
    },
    stop() {
      ticker.stop()
      running = false
      following = undefined
      scripted.clear()
      queue = []
      index = 0
    },
    get running() {
      return running
    },
  }
}
