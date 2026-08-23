import type { ReactNode } from 'react'
import { useWatchPlayback } from '@/features/watch-playback'
import { SEED_PATTERNS } from '@/entities/pattern'
import { Button, Slider } from '@/shared/ui'
import { useTapTempo } from '../lib/use-tap-tempo'
import './transport-bar.css'

export interface TransportBarProps {
  /** Rendered on the right, e.g. the filmstrip/live-pad view switch. */
  children?: ReactNode
}

/** Transport controls for Watch mode (§9.1): play, loop, tempo, count-in,
 *  metronome and step-through, plus the pattern picker. */
export function TransportBar({ children }: TransportBarProps) {
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

  const tap = useTapTempo(setBpm)
  const playing = transportState === 'playing'
  const [minBpm, maxBpm] = pattern.bpmRange

  return (
    <div className="tbar">
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

      <div className="tbar__group">
        <Button icon onClick={() => stepBy(-1)} disabled={playing} aria-label="Previous step">
          ◀
        </Button>
        <Button icon onClick={() => stepBy(1)} disabled={playing} aria-label="Next step">
          ▶
        </Button>
        <span className="tbar__status">
          {playing ? 'playing' : transportState}
        </span>
      </div>

      <div className="tbar__group">
        <Button aria-pressed={metronome} onClick={() => setMetronome(!metronome)}>
          Click
        </Button>
        <Button
          aria-pressed={countInBars > 0}
          onClick={() => setCountInBars(countInBars > 0 ? 0 : 1)}
          aria-label="Count-in"
        >
          Count-in {countInBars > 0 ? `${countInBars} bar` : 'off'}
        </Button>
        <Button aria-pressed={smoothPlayhead} onClick={() => setSmoothPlayhead(!smoothPlayhead)}>
          Playhead
        </Button>
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
