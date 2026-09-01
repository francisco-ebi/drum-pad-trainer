import type { CSSProperties } from 'react'
import { VOICE_META, voiceColor, type PatternIndex } from '@/entities/pattern'
import { HISTOGRAM_BUCKET_MS, type TakeResult } from '@/entities/take'
import { Button } from '@/shared/ui'
import './results-panel.css'

export interface ResultsPanelProps {
  result: TakeResult
  /** Used to name the weak spot's step by its count label (§10.4). */
  index?: PatternIndex
  /** Count row override, so the callout counts the way the player does. */
  labels?: readonly string[]
  /** Best tempo held during a tempo-ladder run (§9.2). */
  bestBpm?: number
  onRetry?: () => void
  onDrillWeakSpot?: (patternStep: number) => void
  onDismiss?: () => void
}

/** Grade, accuracy, timing histogram and the weak-spot callout (§10.4). */
export function ResultsPanel({
  result,
  index,
  labels,
  bestBpm,
  onRetry,
  onDrillWeakSpot,
  onDismiss,
}: ResultsPanelProps) {
  const { stats, timing, weakSpot } = result
  const peak = Math.max(1, ...timing.histogram.map((bucket) => bucket.count))
  const counts = labels ?? index?.labels
  const weakLabel = weakSpot && counts ? (counts[weakSpot.patternStep] ?? '') : ''

  return (
    <section className="results" aria-label="Take results">
      <div className="results__head">
        <div className={`results__grade results__grade--${result.grade}`}>{result.grade}</div>
        <div className="results__figures">
          <div className="results__figure">
            <span className="results__label">Accuracy</span>
            <span className="results__value">{stats.accuracy.toFixed(1)}%</span>
          </div>
          <div className="results__figure">
            <span className="results__label">Score</span>
            <span className="results__value">{stats.score}</span>
          </div>
          <div className="results__figure">
            <span className="results__label">Max combo</span>
            <span className="results__value">{stats.maxCombo}</span>
          </div>
          <div className="results__figure">
            <span className="results__label">Notes</span>
            <span className="results__value">
              {stats.counts.perfect}/{stats.expected}
            </span>
          </div>
          {bestBpm ? (
            <div className="results__figure">
              <span className="results__label">Best tempo</span>
              <span className="results__value">{bestBpm}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="results__section-title">Timing</h3>
        <div className="results__histogram" role="img" aria-label={timing.verdict}>
          {timing.histogram.map((bucket) => (
            <div
              key={bucket.centerMs}
              className={[
                'results__bar',
                bucket.count === 0 ? 'results__bar--empty' : '',
                Math.abs(bucket.centerMs) <= HISTOGRAM_BUCKET_MS / 2 ? 'results__bar--center' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ height: `${(bucket.count / peak) * 100}%` }}
              title={`${bucket.centerMs > 0 ? '+' : ''}${bucket.centerMs} ms: ${bucket.count}`}
            />
          ))}
        </div>
        <div className="results__axis">
          <span>−100 ms (early)</span>
          <span>0</span>
          <span>+100 ms (late)</span>
        </div>
        <p className="results__verdict">{timing.verdict}</p>
        {timing.worstVoice && (
          <p className="results__verdict-sub">
            {VOICE_META[timing.worstVoice.voice].label} is your furthest out, averaging{' '}
            {timing.worstVoice.meanOffsetMs > 0 ? '+' : ''}
            {timing.worstVoice.meanOffsetMs} ms.
          </p>
        )}
      </div>

      {weakSpot && (
        <div className="results__weakspot">
          <p className="results__weakspot-text">
            <span
              className="results__voice-chip"
              style={{ '--voice': voiceColor(weakSpot.voice) } as CSSProperties}
            >
              <span className="results__voice-dot" />
              {VOICE_META[weakSpot.voice].label}
            </span>{' '}
            {weakLabel ? `on the "${weakLabel}"` : `at step ${weakSpot.patternStep + 1}`} needs work —{' '}
            {Math.round(weakSpot.averagePoints)} of 100 across {weakSpot.attempts}{' '}
            {weakSpot.attempts === 1 ? 'pass' : 'passes'}.
          </p>
          {onDrillWeakSpot && (
            <Button onClick={() => onDrillWeakSpot(weakSpot.patternStep)}>Drill that step</Button>
          )}
        </div>
      )}

      <div className="results__actions">
        {onRetry && (
          <Button variant="primary" onClick={onRetry}>
            Retry (R)
          </Button>
        )}
        {onDismiss && <Button onClick={onDismiss}>Back to practice</Button>}
      </div>
    </section>
  )
}
