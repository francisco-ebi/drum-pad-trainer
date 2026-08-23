import { useEffect } from 'react'
import { useWatchPlayback } from '../model/store'

/**
 * Watch-mode keyboard control (§9.1, §15 "fully keyboard-operable"):
 * space toggles playback, arrows step through while stopped.
 */
export function useWatchHotkeys(enabled = true): void {
  useEffect(() => {
    if (!enabled) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return

      const store = useWatchPlayback.getState()
      switch (event.code) {
        case 'Space':
          event.preventDefault()
          store.toggle()
          break
        case 'ArrowRight':
          event.preventDefault()
          store.stepBy(1)
          break
        case 'ArrowLeft':
          event.preventDefault()
          store.stepBy(-1)
          break
        case 'KeyL':
          store.setLoop(!store.loop)
          break
        case 'Escape':
          store.stop()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled])
}
