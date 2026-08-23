import { useState } from 'react'
import { Button, Slider } from '@/shared/ui'
import { PERFECT_PLAYER, SLOPPY_PLAYER, type PlayStyle } from '../lib/script'
import './virtual-midi-panel.css'

export interface VirtualMidiPanelProps {
  /** Run a scripted take in the given style. */
  onRun: (style: PlayStyle) => void
  disabled?: boolean
}

/**
 * Dev-only panel (§13.3) for driving a take without hardware — the same
 * machinery the e2e tests use, exposed so a developer can watch a "perfect"
 * or "sloppy" run go through.
 */
export function VirtualMidiPanel({ onRun, disabled }: VirtualMidiPanelProps) {
  const [offsetMs, setOffsetMs] = useState(20)
  const [jitterMs, setJitterMs] = useState(0)

  return (
    <div className="vmidi">
      <p className="vmidi__title">Virtual MIDI (dev)</p>
      <Slider
        label="Offset"
        value={offsetMs}
        min={-100}
        max={100}
        display={`${offsetMs > 0 ? '+' : ''}${offsetMs} ms`}
        onChange={setOffsetMs}
      />
      <Slider
        label="Jitter"
        value={jitterMs}
        min={0}
        max={80}
        display={`±${jitterMs} ms`}
        onChange={setJitterMs}
      />
      <Button
        variant="primary"
        disabled={disabled}
        onClick={() => onRun({ ...PERFECT_PLAYER, offsetMs, jitterMs })}
      >
        Run scripted take
      </Button>
      <Button disabled={disabled} onClick={() => onRun(SLOPPY_PLAYER)}>
        Sloppy player
      </Button>
      <p className="vmidi__note">
        Strikes carry the exact scripted timestamp, so delivery jitter never reaches the judge.
      </p>
    </div>
  )
}
