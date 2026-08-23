/**
 * A bare interval timer living on a worker thread.
 *
 * Browsers clamp `setInterval` in hidden tabs (Chrome: ~1 Hz, dropping to
 * ~1/min under intensive throttling), which would starve the scheduler's
 * 100 ms lookahead window and drop audio the moment the user tabs away.
 * Dedicated workers are not subject to that clamping, so the tick lives here
 * and the scheduling work stays on the main thread.
 *
 * Typed against a minimal local shape rather than `DedicatedWorkerGlobalScope`,
 * because the app tsconfig loads the DOM lib, not the WebWorker one.
 */
interface WorkerScope {
  onmessage: ((event: MessageEvent) => void) | null
  postMessage(message: unknown): void
}

type Command = { type: 'start'; intervalMs: number } | { type: 'stop' }

const scope = globalThis as unknown as WorkerScope

let timer: ReturnType<typeof setInterval> | undefined

function stop(): void {
  if (timer === undefined) return
  clearInterval(timer)
  timer = undefined
}

scope.onmessage = (event: MessageEvent) => {
  const command = event.data as Command | undefined
  if (command?.type === 'start') {
    stop()
    timer = setInterval(() => scope.postMessage({ type: 'tick' }), command.intervalMs)
  } else if (command?.type === 'stop') {
    stop()
  }
}
