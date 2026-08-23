import { useState } from 'react'
import { isVoiceAudible, useCountInBeats, usePlayheadPosition, usePlayheadStep, useWatchHotkeys, useWatchPlayback, audioAvailable } from '@/features/watch-playback'
import { Filmstrip } from '@/widgets/filmstrip'
import { Sequencer } from '@/widgets/sequencer'
import { TransportBar } from '@/widgets/transport-bar'
import { Button } from '@/shared/ui'
import './session-page.css'

/** The core screen (§12): sequencer on top, filmstrip below, transport docked. */
export function SessionPage() {
  const pattern = useWatchPlayback((s) => s.pattern)
  const index = useWatchPlayback((s) => s.index)
  const range = useWatchPlayback((s) => s.range)
  const muted = useWatchPlayback((s) => s.muted)
  const soloed = useWatchPlayback((s) => s.soloed)
  const smoothPlayhead = useWatchPlayback((s) => s.smoothPlayhead)
  const toggleMute = useWatchPlayback((s) => s.toggleMute)
  const toggleSolo = useWatchPlayback((s) => s.toggleSolo)
  const seekToStep = useWatchPlayback((s) => s.seekToStep)
  const setRange = useWatchPlayback((s) => s.setRange)
  const resetRange = useWatchPlayback((s) => s.resetRange)

  const activeStep = usePlayheadStep()
  const getPosition = usePlayheadPosition()
  const countInBeats = useCountInBeats()
  const [compact, setCompact] = useState(false)
  useWatchHotkeys()

  const isAudible = (voice: Parameters<typeof isVoiceAudible>[1]) =>
    isVoiceAudible({ muted, soloed }, voice)

  return (
    <div className="session">
      <header className="session__head">
        <h1 className="session__title">{pattern.title}</h1>
        <span className="session__level">Level {pattern.level}</span>
        <span className="session__meta">
          {pattern.timeSig[0]}/{pattern.timeSig[1]} · {pattern.subdivision === 16 ? '16th' : '8th'} notes ·{' '}
          {pattern.bpmRange[0]}–{pattern.bpmRange[1]} BPM
        </span>
        {pattern.drill?.notes && <p className="session__notes">{pattern.drill.notes}</p>}
      </header>

      {!audioAvailable() && (
        <p className="session__notice">
          This browser has no Web Audio support, so playback is disabled. Use a Chromium-based
          desktop browser for the full experience (§3).
        </p>
      )}

      <div className="session__views">
        <Sequencer
          index={index}
          activeStep={activeStep}
          range={range}
          isAudible={isAudible}
          soloed={soloed}
          onToggleMute={toggleMute}
          onToggleSolo={toggleSolo}
          onStepClick={seekToStep}
          smoothPlayhead={smoothPlayhead}
          getPosition={getPosition}
        />

        <div className="session__panel">
          <span className="session__panel-label">A/B loop</span>
          <Button onClick={() => setRange(activeStep, range[1])}>Set A ({range[0] + 1})</Button>
          <Button onClick={() => setRange(range[0], activeStep + 1)}>Set B ({range[1]})</Button>
          <Button onClick={resetRange}>Whole pattern</Button>
          <span style={{ flex: 1 }} />
          <Button aria-pressed={compact} onClick={() => setCompact(!compact)}>
            Now / Next
          </Button>
        </div>

        <Filmstrip
          index={index}
          activeStep={activeStep}
          range={range}
          compact={compact}
          onStepClick={seekToStep}
        />
      </div>

      <div className="session__dock">
        <TransportBar />
      </div>

      {countInBeats > 0 && (
        <div className="session__countin" aria-live="polite">
          {countInBeats}
        </div>
      )}
    </div>
  )
}
