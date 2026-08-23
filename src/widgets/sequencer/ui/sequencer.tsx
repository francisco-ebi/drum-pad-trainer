import { useEffect, useRef, type CSSProperties } from 'react'
import {
  hitHand,
  isDownbeat,
  VOICE_META,
  voiceColor,
  type Hit,
  type PatternIndex,
  type Voice,
} from '@/entities/pattern'
import './sequencer.css'

export interface SequencerProps {
  index: PatternIndex
  /** Step currently sounding; -1 for a static render. */
  activeStep: number
  /** A/B loop range in pattern steps; steps outside it are dimmed. */
  range?: [number, number]
  isAudible?: (voice: Voice) => boolean
  soloed?: Voice[]
  onToggleMute?: (voice: Voice) => void
  onToggleSolo?: (voice: Voice) => void
  onStepClick?: (step: number) => void
  /** Continuous playhead bar instead of relying on the column alone (§6.1). */
  smoothPlayhead?: boolean
  /** Per-frame position source; only read when `smoothPlayhead` is on. */
  getPosition?: () => number
}

function Token({ hit }: { hit: Hit }) {
  const classes = [
    'seq__token',
    hitHand(hit) === 'L' ? 'seq__token--alt' : 'seq__token--lead',
    hit.accent ? 'is-accent' : '',
    hit.ghost ? 'is-ghost' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return <span className={classes} style={{ '--voice': voiceColor(hit.voice) } as CSSProperties} />
}

/** Continuous bar swept from the transport clock — never a CSS timer (§6.4). */
function Playhead({ index, getPosition }: { index: PatternIndex; getPosition: () => number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = requestAnimationFrame(function loop() {
      const node = ref.current
      if (node) {
        const track = node.parentElement
        const width = track ? track.clientWidth - parseFloat(getComputedStyle(track).getPropertyValue('--lane-label-w') || '0') : 0
        const fraction = getPosition() / index.totalSteps
        node.style.transform = `translateX(${fraction * width}px)`
      }
      frame = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(frame)
  }, [index.totalSteps, getPosition])

  return <div ref={ref} className="seq__playhead" aria-hidden="true" />
}

/**
 * The score grid (§6.1): one column per step, one row per lane, count labels
 * on top. Purely presentational — every animated value arrives as a prop, so
 * the same component renders a live take and a static reference image.
 */
export function Sequencer({
  index,
  activeStep,
  range,
  isAudible,
  soloed = [],
  onToggleMute,
  onToggleSolo,
  onStepClick,
  smoothPlayhead = false,
  getPosition,
}: SequencerProps) {
  const [rangeStart, rangeEnd] = range ?? [0, index.totalSteps]
  const showLaneControls = Boolean(onToggleMute ?? onToggleSolo)

  return (
    <section className="seq" aria-label={`Sequencer: ${index.pattern.title}`}>
      <div className="seq__grid" style={{ '--steps': index.totalSteps } as CSSProperties}>
        <div className="seq__corner" />
        {index.labels.map((label, step) => (
          <div
            key={`count-${step}`}
            className={[
              'seq__count',
              isDownbeat(index, step) ? 'is-downbeat' : '',
              step === activeStep ? 'is-active' : '',
              step < rangeStart || step >= rangeEnd ? 'is-outside' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {label}
          </div>
        ))}

        {index.lanes.map((lane) => {
          const meta = VOICE_META[lane.voice]
          const audible = isAudible ? isAudible(lane.voice) : true
          return (
            <div key={lane.voice} style={{ display: 'contents' }}>
              <div
                className={`seq__lane-label${audible ? '' : ' is-silent'}`}
                style={{ '--voice': voiceColor(lane.voice) } as CSSProperties}
              >
                <span className="seq__lane-name">{meta.label}</span>
                {showLaneControls && (
                  <>
                    <button
                      type="button"
                      className="seq__lane-toggle"
                      aria-pressed={!audible && soloed.length === 0}
                      aria-label={`Mute ${meta.label}`}
                      onClick={() => onToggleMute?.(lane.voice)}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      className="seq__lane-toggle"
                      aria-pressed={soloed.includes(lane.voice)}
                      aria-label={`Solo ${meta.label}`}
                      onClick={() => onToggleSolo?.(lane.voice)}
                    >
                      S
                    </button>
                  </>
                )}
              </div>

              {lane.cells.map((hit, step) => (
                <button
                  key={`${lane.voice}-${step}`}
                  type="button"
                  className={[
                    'seq__cell',
                    isDownbeat(index, step) ? 'is-downbeat' : '',
                    step === activeStep ? 'is-active' : '',
                    step < rangeStart || step >= rangeEnd ? 'is-outside' : '',
                    audible ? '' : 'is-silent',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={
                    hit
                      ? `${meta.label} on ${index.labels[step] ?? step + 1}, ${hitHand(hit) === 'L' ? 'alternate' : 'lead'} hand`
                      : `${meta.label}, rest on ${index.labels[step] ?? step + 1}`
                  }
                  onClick={() => onStepClick?.(step)}
                >
                  {hit && <Token hit={hit} />}
                </button>
              ))}
            </div>
          )
        })}

        {smoothPlayhead && getPosition && <Playhead index={index} getPosition={getPosition} />}
      </div>
    </section>
  )
}
