import type { ReactNode } from 'react'
import { SEED_PATTERNS } from '@/entities/pattern'
import { usePracticeTake } from '@/features/practice-take'
import { useWatchPlayback } from '@/features/watch-playback'
import { Button, Slider } from '@/shared/ui'
import { useTapTempo } from '../lib/use-tap-tempo'
import './transport-bar.css'

export type SessionMode = 'watch' | 'practice'

export interface TransportBarProps {
  mode: SessionMode
  onModeChange: (mode: SessionMode) => void
  /** Rendered at the end of the bar. */
  children?: ReactNode
}

/**
 * The docked control bar (§12): mode switcher, transport, tempo and pattern.
 *
 * Watch and Practice drive the same transport but through different controls —
 * Watch scrubs and loops freely, Practice starts and ends takes — so the bar
 * swaps its middle section rather than showing controls that do nothing.
 */
export function TransportBar({ mode, onModeChange, children }: TransportBarProps) {
  const pattern = useWatchPlayback((s) => s.pattern)
  const transportState = useWatchPlayback((s) => s.transportState)
  const bpm = useWatchPlayback((s) => s.bpm)
  const loop = useWatchPlayback((s) => s.loop)
  const metronome = useWatchPlayback((s) => s.metronome)
  const countInBars = useWatchPlayback((s) => s.countInBars)
  const smoothPlayhead = useWatchPlayback((s) => s.smoothPlayhead)

  const toggle = useWatchPlayback((s) => s.toggle)
  const stop = useWatchPlayback((s) => s.stop)
  const setBpm = useWatchPlayback((s) => s.setBpm)
  const setLoop = useWatchPlayback((s) => s.setLoop)
  const setMetronome = useWatchPlayback((s) => s.setMetronome)
  const setCountInBars = useWatchPlayback((s) => s.setCountInBars)
  const setSmoothPlayhead = useWatchPlayback((s) => s.setSmoothPlayhead)
  const stepBy = useWatchPlayback((s) => s.stepBy)
  const loadPattern = useWatchPlayback((s) => s.loadPattern)

  const practiceStatus = usePracticeTake((s) => s.status)
  const startTake = usePracticeTake((s) => s.start)
  const stopTake = usePracticeTake((s) => s.stop)
  const practiceMetronome = usePracticeTake((s) => s.metronome)
  const setPracticeMetronome = usePracticeTake((s) => s.setMetronome)
  const practiceCountIn = usePracticeTake((s) => s.countInBars)
  const setPracticeCountIn = usePracticeTake((s) => s.setCountInBars)

  const tap = useTapTempo(setBpm)
  const playing = transportState === 'playing'
  const running = practiceStatus === 'running'
  const [minBpm, maxBpm] = pattern.bpmRange
  const isPractice = mode === 'practice'

  return (
    <div className="tbar">
      <div className="tbar__group" role="group" aria-label="Mode">
        <Button aria-pressed={mode === 'watch'} onClick={() => onModeChange('watch')}>
          Watch
        </Button>
        <Button aria-pressed={isPractice} onClick={() => onModeChange('practice')}>
          Practice
        </Button>
      </div>

      {isPractice ? (
        <div className="tbar__group">
          <Button
            variant="primary"
            onClick={() => (running ? stopTake() : void startTake())}
            aria-label={running ? 'End take' : 'Start take'}
          >
            {running ? '■ End take' : '▶ Start take'}
          </Button>
          <span className="tbar__status">{running ? 'take running' : practiceStatus}</span>
        </div>
      ) : (
        <div className="tbar__group">
          <Button variant="primary" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? '❚❚ Pause' : '▶ Play'}
          </Button>
          <Button onClick={stop} aria-label="Stop">
            ■
          </Button>
          <Button aria-pressed={loop} onClick={() => setLoop(!loop)} aria-label="Loop">
            ↻ Loop
          </Button>
        </div>
      )}

      <div className="tbar__group">
        <Slider
          label="Tempo"
          value={bpm}
          min={minBpm}
          max={maxBpm}
          display={`${bpm} BPM`}
          onChange={setBpm}
        />
        <Button onClick={tap} aria-label="Tap tempo">
          Tap
        </Button>
      </div>

      {!isPractice && (
        <div className="tbar__group">
          <Button icon onClick={() => stepBy(-1)} disabled={playing} aria-label="Previous step">
            ◀
          </Button>
          <Button icon onClick={() => stepBy(1)} disabled={playing} aria-label="Next step">
            ▶
          </Button>
          <span className="tbar__status">{playing ? 'playing' : transportState}</span>
        </div>
      )}

      <div className="tbar__group">
        <Button
          aria-pressed={isPractice ? practiceMetronome : metronome}
          onClick={() => (isPractice ? setPracticeMetronome(!practiceMetronome) : setMetronome(!metronome))}
        >
          Click
        </Button>
        <Button
          aria-pressed={(isPractice ? practiceCountIn : countInBars) > 0}
          onClick={() =>
            isPractice
              ? setPracticeCountIn(practiceCountIn > 0 ? 0 : 1)
              : setCountInBars(countInBars > 0 ? 0 : 1)
          }
          aria-label="Count-in"
        >
          Count-in {(isPractice ? practiceCountIn : countInBars) > 0 ? '1 bar' : 'off'}
        </Button>
        {!isPractice && (
          <Button aria-pressed={smoothPlayhead} onClick={() => setSmoothPlayhead(!smoothPlayhead)}>
            Playhead
          </Button>
        )}
      </div>

      <div className="tbar__spacer" />

      <div className="tbar__group">
        <label className="ui-field" htmlFor="pattern-picker">
          Pattern
        </label>
        <select
          id="pattern-picker"
          className="tbar__select"
          value={pattern.id}
          disabled={running}
          onChange={(event) => loadPattern(event.target.value)}
        >
          {SEED_PATTERNS.map((seed) => (
            <option key={seed.id} value={seed.id}>
              {seed.title}
            </option>
          ))}
        </select>
        {children}
      </div>
    </div>
  )
}
