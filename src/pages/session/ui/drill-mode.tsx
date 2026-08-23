import { getBadge } from '@/entities/progress'
import { useAssessDrill } from '@/features/assess-drill'
import { PracticeHud } from '@/widgets/practice-hud'
import { ResultsPanel } from '@/widgets/results-panel'
import { Button, Slider } from '@/shared/ui'
import type { PatternIndex } from '@/entities/pattern'
import { VirtualMidiPanel, type PlayStyle } from '@/features/virtual-midi'

export interface DrillModeProps {
  index: PatternIndex
  onDrillWeakSpot?: (step: number) => void
  /** Dev-only scripted take runner (§13.3). */
  onRunScripted?: (style: PlayStyle) => void
}

function Stars({ earned }: { earned: number }) {
  return (
    <span className="drill__stars" aria-label={`${earned} of 3 stars`}>
      {'★'.repeat(earned)}
      {'☆'.repeat(3 - earned)}
    </span>
  )
}

/** An assessed take (§9.3): fixed rules, a fixed number of loops, stars out. */
export function DrillMode({ index, onDrillWeakSpot, onRunScripted }: DrillModeProps) {
  const drill = useAssessDrill((s) => s.drill)
  const pattern = useAssessDrill((s) => s.pattern)
  const status = useAssessDrill((s) => s.status)
  const bpm = useAssessDrill((s) => s.bpm)
  const stats = useAssessDrill((s) => s.stats)
  const lastJudgment = useAssessDrill((s) => s.lastJudgment)
  const result = useAssessDrill((s) => s.result)
  const stars = useAssessDrill((s) => s.stars)
  const award = useAssessDrill((s) => s.award)
  const interrupted = useAssessDrill((s) => s.interrupted)
  const setBpm = useAssessDrill((s) => s.setBpm)
  const start = useAssessDrill((s) => s.start)
  const abandon = useAssessDrill((s) => s.abandon)
  const retry = useAssessDrill((s) => s.retry)

  if (!drill || !pattern) {
    return (
      <p className="session__notice">
        Open a drill from the Library to run an assessed take.
      </p>
    )
  }

  const running = status === 'running'
  const [min, max] = pattern.bpmRange

  return (
    <div className="session__options">
      <div className="session__panel">
        <span className="session__panel-label">Assessed take</span>
        <Slider
          label="Tempo"
          value={bpm}
          min={min}
          max={max}
          step={5}
          display={`${bpm} BPM`}
          disabled={running}
          onChange={setBpm}
        />
        <Button variant="primary" onClick={() => (running ? abandon() : void start())}>
          {running ? '■ Abandon' : `▶ Run ${drill.loops} loops`}
        </Button>
        {bpm < drill.targetBpm && (
          <span className="session__hint">
            Below the {drill.targetBpm} BPM target — accuracy counts, stars stay locked.
          </span>
        )}
      </div>

      {onRunScripted && <VirtualMidiPanel onRun={onRunScripted} disabled={!running} />}

      {(running || result) && (
        <PracticeHud stats={stats} lastJudgment={lastJudgment} bpm={bpm} />
      )}

      {interrupted && (
        <p className="session__notice" role="alert">
          The controller disconnected part-way, so this take was not recorded. Reconnect and run it
          again.
        </p>
      )}

      {result && stars && (
        <>
          <div className="session__panel">
            <span className="session__panel-label">Stars</span>
            <Stars earned={stars.stars} />
            {stars.lockedByTempo ? (
              <span className="session__hint">
                Locked — this drill awards stars at {drill.targetBpm} BPM and up.
              </span>
            ) : stars.nextThreshold !== undefined ? (
              <span className="session__hint">{stars.nextThreshold}% for the next star.</span>
            ) : (
              <span className="session__hint">Full marks. Try it faster.</span>
            )}
            {award?.speedTrophy && <span className="session__hint">🏆 New best tempo: {bpm} BPM</span>}
            {award && award.xpGained > 0 && <span className="session__hint">+{award.xpGained} XP</span>}
          </div>

          {award && award.newBadges.length > 0 && (
            <div className="session__panel">
              <span className="session__panel-label">New badges</span>
              {award.newBadges.map((id) => {
                const badge = getBadge(id)
                return (
                  <span key={id} className="session__hint">
                    {badge?.icon} {badge?.title}
                  </span>
                )
              })}
            </div>
          )}

          <ResultsPanel
            result={result}
            index={index}
            onRetry={() => void retry()}
            {...(onDrillWeakSpot ? { onDrillWeakSpot } : {})}
          />
        </>
      )}
    </div>
  )
}
