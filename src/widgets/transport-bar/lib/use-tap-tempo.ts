import { useCallback, useRef } from 'react'

/** Tap-tempo (§9.1): average the last few taps, forget a stale series. */
export function useTapTempo(onTempo: (bpm: number) => void, { maxTaps = 5, resetAfterMs = 2000 } = {}) {
  const taps = useRef<number[]>([])

  return useCallback(() => {
    const now = performance.now()
    const last = taps.current[taps.current.length - 1]
    if (last !== undefined && now - last > resetAfterMs) taps.current = []
    taps.current.push(now)
    if (taps.current.length > maxTaps) taps.current.shift()

    const stamps = taps.current
    if (stamps.length < 2) return
    const first = stamps[0]
    const latest = stamps[stamps.length - 1]
    if (first === undefined || latest === undefined) return
    const averageGap = (latest - first) / (stamps.length - 1)
    if (averageGap <= 0) return
    onTempo(Math.round(60000 / averageGap))
  }, [onTempo, maxTaps, resetAfterMs])
}
