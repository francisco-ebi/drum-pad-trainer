import { AudioEngine } from './audio'
import { Transport } from './transport'

/**
 * The single audio engine and transport the app runs on.
 *
 * §13.1 puts the transport, scheduler and sampler in `shared/lib` as
 * infrastructure; these are the live instances of it. They are here rather
 * than inside a feature because Watch, Practice and Drill modes all drive the
 * same clock — two transports would mean two ideas of "now".
 *
 * Instances are created lazily: constructing an AudioContext before a user
 * gesture is pointless, and unavailable under jsdom.
 */
let engine: AudioEngine | undefined
let transport: Transport | undefined

export function audioAvailable(): boolean {
  return typeof AudioContext !== 'undefined'
}

export function getAudioEngine(): AudioEngine {
  engine ??= new AudioEngine()
  return engine
}

export function getTransport(): Transport {
  if (!transport) {
    const audio = getAudioEngine()
    transport = new Transport({
      clock: audio.clock,
      // Pair the input and audio timelines at the output where the browser
      // can tell us (§8.2).
      anchorSource: () => audio.captureAnchor(),
      bpm: 80,
      subdivision: 8,
      timeSig: [4, 4],
      bars: 1,
    })
  }
  return transport
}

/** Render the kit and lift the browser's autoplay suspension. */
export async function primeAudio(): Promise<void> {
  const audio = getAudioEngine()
  await audio.resume()
  await audio.ready()
}

/** Test seam: drop the instances so a fresh runtime can be built. */
export function resetRuntime(): void {
  transport?.dispose()
  transport = undefined
  engine = undefined
}
