import { useMemo } from 'react'
import { DEFAULT_PAD_LAYOUT, resolvePad, type PadLayout } from '@/entities/device'
import { hitHand, VOICE_META, type PatternIndex } from '@/entities/pattern'
import { ALL_PADS, padKey } from '@/shared/config'
import { spokenCount } from './spoken-count'
import './filmstrip.css'

export interface FilmstripProps {
  index: PatternIndex
  /** Step currently sounding; -1 for a static render. */
  activeStep: number
  /** Count row override; defaults to the pattern's own labels (§5). */
  labels?: readonly string[]
  range?: [number, number]
  layout?: PadLayout
  leftHanded?: boolean
  /** Force the "Now / Next" pair regardless of viewport width. */
  compact?: boolean
  onStepClick?: (step: number) => void
}

type Marker = 'lead' | 'alt'

/** For each step: which pad gets which marker, and the voices involved. */
function buildFrames(index: PatternIndex, layout: PadLayout, leftHanded: boolean) {
  return index.steps.map((hits) => {
    const marks = new Map<string, Marker>()
    const voices: string[] = []
    for (const hit of hits) {
      const hand = hitHand(hit)
      const pad = resolvePad(hit.voice, hand, { layout, leftHanded })
      if (pad) marks.set(padKey(pad), hand === 'L' ? 'alt' : 'lead')
      voices.push(VOICE_META[hit.voice].label)
    }
    return { marks, voices }
  })
}

/**
 * One mini 4x4 frame per step (§6.2): red circle = lead hand, orange diamond =
 * alternate hand. With no playback running this is the printable reference
 * material, which is why the static render is snapshot-tested.
 */
export function Filmstrip({
  index,
  activeStep,
  labels,
  range,
  layout = DEFAULT_PAD_LAYOUT,
  leftHanded = false,
  compact = false,
  onStepClick,
}: FilmstripProps) {
  const frames = useMemo(() => buildFrames(index, layout, leftHanded), [index, layout, leftHanded])
  const [rangeStart, rangeEnd] = range ?? [0, index.totalSteps]
  const nextStep = activeStep >= 0 ? (activeStep + 1) % index.totalSteps : -1
  const counts = labels ?? index.labels

  return (
    <section className={`strip${compact ? ' strip--compact' : ''}`} aria-label="Pad filmstrip">
      <div className="strip__frames">
        {frames.map((frame, step) => (
          <button
            key={step}
            type="button"
            className={[
              'strip__frame',
              step === activeStep ? 'is-active' : '',
              step === nextStep ? 'is-next' : '',
              activeStep >= 0 && step < activeStep ? 'is-past' : '',
              step < rangeStart || step >= rangeEnd ? 'is-outside' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label={
              frame.voices.length > 0
                ? `Step ${step + 1} (${counts[step] ?? ''}): ${frame.voices.join(', ')}`
                : `Step ${step + 1} (${counts[step] ?? ''}): rest`
            }
            aria-current={step === activeStep ? 'step' : undefined}
            onClick={() => onStepClick?.(step)}
          >
            <div className="strip__pads" aria-hidden="true">
              {ALL_PADS.map((pad) => {
                const mark = frame.marks.get(padKey(pad))
                return (
                  <div key={padKey(pad)} className="strip__pad">
                    {mark && <span className={`strip__mark strip__mark--${mark}`} />}
                  </div>
                )
              })}
            </div>
            <span className="strip__caption">{spokenCount(counts[step] ?? '')}</span>
          </button>
        ))}
      </div>

      <div className="strip__legend">
        <span>
          <span className="strip__mark strip__mark--lead" /> lead hand
        </span>
        <span>
          <span className="strip__mark strip__mark--alt" /> alternate hand
        </span>
      </div>
    </section>
  )
}
