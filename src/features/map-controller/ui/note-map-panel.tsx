import {
  activeMapping,
  activeRecord,
  KEYBOARD_DEVICE_NAME,
  MAPPING_PRESETS,
  notesForPad,
  unmappedPads,
  useDeviceStore,
  voiceAtPad,
} from '@/entities/device'
import { VOICE_META } from '@/entities/pattern'
import { ALL_PADS } from '@/shared/config'
import { Button } from '@/shared/ui'
import { currentPad, useLearnMapping } from '../model/store'

/** Mapping presets and the pad-by-pad learn wizard (§4.3). */
export function NoteMapPanel() {
  const record = useDeviceStore(activeRecord)
  const mapping = useDeviceStore(activeMapping)
  const applyPreset = useDeviceStore((s) => s.applyPreset)
  const deviceName = useDeviceStore((s) => s.activeDeviceName)

  const learnStep = useLearnMapping((s) => s.step)
  const lastNote = useLearnMapping((s) => s.lastNote)
  const startLearn = useLearnMapping((s) => s.start)
  const skip = useLearnMapping((s) => s.skip)
  const cancel = useLearnMapping((s) => s.cancel)
  const target = useLearnMapping(currentPad)

  const targetVoice = target ? voiceAtPad(target) : undefined
  const missing = unmappedPads(mapping).length
  // The keyboard fallback yields pads directly, so it has no note map to fill.
  const keyboardOnly = deviceName === KEYBOARD_DEVICE_NAME

  return (
    <>
      <div className="session__panel">
        <span className="session__panel-label">Note map</span>
        {keyboardOnly && (
          <span className="session__hint">
            Keyboard input needs no note map — pick a MIDI device to map one.
          </span>
        )}
        <select
          className="tbar__select"
          aria-label="Mapping preset"
          disabled={keyboardOnly}
          value={record?.mappingSource ?? 'general-midi'}
          onChange={(event) => applyPreset(event.target.value as 'general-midi' | 'chromatic-36')}
        >
          {MAPPING_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
          {record?.mappingSource === 'learned' && <option value="learned">Learned</option>}
        </select>
        <Button onClick={() => void startLearn()} disabled={learnStep >= 0 || keyboardOnly}>
          Learn pads
        </Button>
        {!keyboardOnly && (
          <span className="session__hint">
            {missing === 0 ? 'All 16 pads mapped' : `${missing} of ${ALL_PADS.length} pads unmapped`}
          </span>
        )}
      </div>

      {learnStep >= 0 && target && (
        <div className="session__panel" aria-live="polite">
          <span className="session__panel-label">
            Learning {learnStep + 1}/{ALL_PADS.length}
          </span>
          <strong>
            Hit the {targetVoice ? VOICE_META[targetVoice].label : 'pad'} pad — row {target.row},
            column {target.col}
          </strong>
          {lastNote !== undefined && <span className="session__hint">Last note: {lastNote}</span>}
          {notesForPad(mapping, target).length > 0 && (
            <span className="session__hint">
              Currently: {notesForPad(mapping, target).join(', ')}
            </span>
          )}
          <Button onClick={skip}>Skip</Button>
          <Button onClick={cancel}>Done</Button>
        </div>
      )}
    </>
  )
}
