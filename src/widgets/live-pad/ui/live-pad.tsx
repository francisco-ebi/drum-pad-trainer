import { useEffect, useRef, type CSSProperties } from 'react'
import { DEFAULT_PAD_LAYOUT, voiceAtPad, type PadLayout } from '@/entities/device'
import { VOICE_META, voiceColor, type Voice } from '@/entities/pattern'
import { ALL_PADS, KEYBOARD_PAD_CODES, padKey, samePad, type PadIndex } from '@/shared/config'
import './live-pad.css'

/** One note on its way to a pad — what an approach ring tracks. */
export interface PadCue {
  pad: PadIndex
  voice: Voice
  /** Seconds until it is due; negative once it is past. */
  secondsUntil: number
}

export interface PadFeedback {
  pad: PadIndex
  kind: 'good' | 'bad' | 'missed'
  /** Judgment label to show, e.g. "Perfect". */
  label?: string
  /** The pad that *should* have been struck, on a wrong-pad hit. */
  expectedPad?: PadIndex
}

export interface LivePadProps {
  layout?: PadLayout
  /** Cues due within the ring horizon; re-read every frame. */
  getCues?: (nowSec: number) => PadCue[]
  /** Audio-clock reader; required for the rings to mean anything. */
  getNow?: () => number
  /** Ring travel time — one beat (§6.3). */
  horizonSec?: number
  /** Notes owed on the current step in wait mode (§9.2). */
  waitingFor?: readonly { pad: PadIndex }[]
  /** The most recent hit feedback; changing this re-triggers the flash. */
  feedback?: PadFeedback | undefined
  /** Show the keyboard fallback letters on each pad (§3). */
  showKeys?: boolean
  onPadDown?: (pad: PadIndex) => void
}

function keyLabel(pad: PadIndex): string {
  const code = KEYBOARD_PAD_CODES[pad.row - 1]?.[pad.col - 1] ?? ''
  return code.replace(/^(Key|Digit)/, '')
}

/**
 * The controller mirrored on screen (§6.3): what to hit, when to hit it, and
 * what happened when you did.
 *
 * The rings are the timing cue — a rhythm-game note highway collapsed onto the
 * pad itself — so they are driven straight from the audio clock on every
 * frame, and never from a CSS animation that could drift.
 */
export function LivePad({
  layout = DEFAULT_PAD_LAYOUT,
  getCues,
  getNow,
  horizonSec = 0.5,
  waitingFor = [],
  feedback,
  showKeys = true,
  onPadDown,
}: LivePadProps) {
  const ringRefs = useRef(new Map<string, HTMLSpanElement>())

  useEffect(() => {
    if (!getCues || !getNow) return
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

    let frame = requestAnimationFrame(function loop() {
      const now = getNow()
      const cues = new Map<string, PadCue>()
      for (const cue of getCues(now)) {
        const key = padKey(cue.pad)
        const existing = cues.get(key)
        // Nearest cue wins: one ring per pad, tracking the next note due.
        if (!existing || cue.secondsUntil < existing.secondsUntil) cues.set(key, cue)
      }

      for (const [key, node] of ringRefs.current) {
        const cue = cues.get(key)
        if (!cue || cue.secondsUntil > horizonSec || cue.secondsUntil < -0.05) {
          node.style.opacity = '0'
          continue
        }
        const progress = Math.max(0, Math.min(1, cue.secondsUntil / horizonSec))
        node.style.setProperty('--voice', voiceColor(cue.voice))
        node.style.opacity = String(0.25 + (1 - progress) * 0.75)
        // Reaches the pad edge (scale 1) exactly when the note is due.
        node.style.transform = reduced ? '' : `scale(${1 + progress * 1.15})`
      }
      frame = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(frame)
  }, [getCues, getNow, horizonSec])

  return (
    <section className="pad" aria-label="Controller">
      <div className="pad__grid">
        {ALL_PADS.map((pad) => {
          const voice = voiceAtPad(pad, layout)
          const meta = voice ? VOICE_META[voice] : undefined
          const isWaiting = waitingFor.some((target) => samePad(target.pad, pad))
          const isStruck = feedback && samePad(feedback.pad, pad)
          const isExpectedPad = feedback?.expectedPad && samePad(feedback.expectedPad, pad)

          return (
            <button
              key={padKey(pad)}
              type="button"
              className={[
                'pad__cell',
                isWaiting ? 'is-waiting' : '',
                isStruck ? 'is-flash' : '',
                isStruck && feedback.kind === 'good' ? 'is-hit-good' : '',
                isStruck && feedback.kind === 'bad' ? 'is-hit-bad' : '',
                isStruck && feedback.kind === 'missed' ? 'is-missed' : '',
                isExpectedPad ? 'is-expected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ '--voice': voice ? voiceColor(voice) : 'var(--c-accent)' } as CSSProperties}
              aria-label={meta ? `${meta.label} pad, row ${pad.row} column ${pad.col}` : 'Unassigned pad'}
              onPointerDown={() => onPadDown?.(pad)}
            >
              <span className="pad__flash" aria-hidden="true" />
              <span
                className="pad__ring"
                aria-hidden="true"
                ref={(node) => {
                  if (node) ringRefs.current.set(padKey(pad), node)
                  else ringRefs.current.delete(padKey(pad))
                }}
              />
              <span className="pad__label">{meta?.label ?? '—'}</span>
              {showKeys && <span className="pad__key">{keyLabel(pad)}</span>}
            </button>
          )
        })}
      </div>
      <p className="pad__legend">
        Rings close on the pad as the note falls due · keyboard fallback shown on each pad
      </p>
    </section>
  )
}
