/**
 * Where the scheduler's heartbeat comes from. Isolating it keeps the throttling
 * problem in one place: the scheduler asks for ticks, not for a timer.
 */
export interface TickSource {
  /** Which implementation this is — surfaced for diagnostics and tests. */
  readonly kind: 'worker' | 'interval'
  start(intervalMs: number, onTick: () => void): void
  stop(): void
  /** Release the underlying thread or timer for good. */
  dispose(): void
}

/** Main-thread `setInterval`. Throttled in hidden tabs; used as the fallback
 *  where workers are unavailable, and in tests, where fake timers drive it. */
export function intervalTickSource(): TickSource {
  let timer: ReturnType<typeof setInterval> | undefined

  const stop = () => {
    if (timer === undefined) return
    clearInterval(timer)
    timer = undefined
  }

  return {
    kind: 'interval',
    start(intervalMs, onTick) {
      stop()
      timer = setInterval(onTick, intervalMs)
    },
    stop,
    dispose: stop,
  }
}

/** Worker-thread timer, immune to background-tab clamping. Returns undefined
 *  when workers are unavailable (jsdom, or a blocked worker URL). */
export function workerTickSource(): TickSource | undefined {
  if (typeof Worker === 'undefined') return undefined

  let worker: Worker
  try {
    worker = new Worker(new URL('./timer.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    return undefined
  }

  let listener: ((event: MessageEvent) => void) | undefined

  const stop = () => {
    worker.postMessage({ type: 'stop' })
    if (listener) {
      worker.removeEventListener('message', listener)
      listener = undefined
    }
  }

  return {
    kind: 'worker',
    start(intervalMs, onTick) {
      stop()
      listener = () => onTick()
      worker.addEventListener('message', listener)
      worker.postMessage({ type: 'start', intervalMs })
    },
    stop,
    dispose() {
      stop()
      worker.terminate()
    },
  }
}

/** Worker where possible, main-thread interval where not. */
export function defaultTickSource(): TickSource {
  return workerTickSource() ?? intervalTickSource()
}
