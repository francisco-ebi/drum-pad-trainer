import type { Judgment, TakeStats } from '@/entities/take'
import './practice-hud.css'

export interface PracticeHudProps {
  stats: TakeStats | undefined
  lastJudgment: Judgment | undefined
  /** Shown while the tempo ladder is climbing (§9.2). */
  sessionBestBpm?: number
  bpm?: number
}

const JUDGMENT_LABEL: Record<Judgment['grade'], string> = {
  perfect: 'Perfect',
  good: 'Good',
  miss: 'Miss',
  wrongPad: 'Wrong pad',
  extra: 'Extra',
}

/** Live take feedback (§9.2): combo, rolling accuracy, per-hit labels. */
export function PracticeHud({ stats, lastJudgment, sessionBestBpm, bpm }: PracticeHudProps) {
  const accuracy = stats ? Math.round(stats.accuracy) : 0
  const accuracyTone = accuracy >= 90 ? 'good' : accuracy >= 75 ? 'accent' : 'danger'

  return (
    <section className="hud" aria-label="Practice feedback">
      <div className="hud__stat">
        <span className="hud__label">Combo</span>
        <span className="hud__value hud__value--accent">{stats?.combo ?? 0}</span>
        <span className="hud__sub">×{stats?.multiplier ?? 1} · best {stats?.maxCombo ?? 0}</span>
      </div>

      <div className="hud__stat">
        <span className="hud__label">Accuracy</span>
        <span className={`hud__value hud__value--${accuracyTone}`} aria-live="polite">
          {accuracy}%
        </span>
        <span className="hud__sub">
          {stats?.resolved ?? 0} of {stats?.expected ?? 0} notes
        </span>
      </div>

      <div className="hud__stat">
        <span className="hud__label">Score</span>
        <span className="hud__value">{stats?.score ?? 0}</span>
      </div>

      {bpm !== undefined && (
        <div className="hud__stat">
          <span className="hud__label">Tempo</span>
          <span className="hud__value">{bpm}</span>
          <span className="hud__sub">
            {sessionBestBpm ? `best ${sessionBestBpm} BPM` : 'BPM'}
          </span>
        </div>
      )}

      <div className="hud__counts" aria-label="Judgment counts">
        <span>P {stats?.counts.perfect ?? 0}</span>
        <span>G {stats?.counts.good ?? 0}</span>
        <span>M {stats?.counts.miss ?? 0}</span>
        <span>X {(stats?.counts.wrongPad ?? 0) + (stats?.counts.extra ?? 0)}</span>
      </div>

      <div className="hud__judgment" aria-live="polite">
        {lastJudgment && (
          <>
            <span
              key={`${lastJudgment.grade}-${stats?.resolved ?? 0}-${stats?.counts.extra ?? 0}`}
              className={`hud__chip hud__chip--${lastJudgment.grade}`}
            >
              {JUDGMENT_LABEL[lastJudgment.grade]}
            </span>
            {lastJudgment.direction && (
              <span className="hud__direction">
                {lastJudgment.direction === 'early' ? '◀ early' : 'late ▶'}{' '}
                {Math.abs(Math.round((lastJudgment.offsetSec ?? 0) * 1000))} ms
              </span>
            )}
          </>
        )}
      </div>
    </section>
  )
}
