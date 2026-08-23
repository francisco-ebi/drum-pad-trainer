import { useId } from 'react'
import './ui.css'

export interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Rendered next to the label, e.g. "80 BPM". */
  display?: string
  disabled?: boolean
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step = 1, display, disabled, onChange }: SliderProps) {
  const id = useId()
  return (
    <div className="ui-slider">
      <div className="ui-slider__head">
        <label htmlFor={id}>{label}</label>
        <span className="ui-slider__value">{display ?? value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}
