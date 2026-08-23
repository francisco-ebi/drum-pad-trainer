import { useEffect, useMemo, useState } from 'react'
import { audioAvailable, getTransport } from '@/shared/lib/runtime'
import { useWatchPlayback } from '../model/store'

/**
 * The active step, read from the transport clock on every animation frame
 * (§6.4: positions come from `transport.position`, never from CSS timers).
 * Re-renders only when the integer step actually changes.
 */
export function usePlayheadStep(): number {
  const transportState = useWatchPlayback((s) => s.transportState)
  const range = useWatchPlayback((s) => s.range)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!audioAvailable()) return
    const transport = getTransport()
    const read = () => {
      const next = Math.floor(transport.position)
      setStep((prev) => (prev === next ? prev : next))
    }
    read()

    if (transportState !== 'playing') {
      // Step-through and seeks move the playhead without a running clock.
      return transport.on('state', read)
    }

    let frame = requestAnimationFrame(function loop() {
      read()
      frame = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(frame)
  }, [transportState, range])

  return step
}

/** Stable getter for per-frame animation that must not re-render React. */
export function usePlayheadPosition(): () => number {
  return useMemo(() => {
    if (!audioAvailable()) return () => 0
    const transport = getTransport()
    return () => transport.position
  }, [])
}

/** Beats of count-in still to run, 0 once the pattern is playing (§7.3). */
export function useCountInBeats(): number {
  const transportState = useWatchPlayback((s) => s.transportState)
  const subdivision = useWatchPlayback((s) => s.pattern.subdivision)
  const [beats, setBeats] = useState(0)

  useEffect(() => {
    if (!audioAvailable() || transportState !== 'playing') {
      setBeats(0)
      return
    }
    const transport = getTransport()
    const stepsPerBeat = subdivision / 4
    let frame = requestAnimationFrame(function loop() {
      const next = Math.ceil(transport.countInRemaining / stepsPerBeat)
      setBeats((prev) => (prev === next ? prev : next))
      frame = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(frame)
  }, [transportState, subdivision])

  return beats
}
