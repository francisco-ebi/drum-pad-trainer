import { VOICE_META } from '@/entities/pattern'
import { LANE_PRESETS, usePracticeTake } from '@/features/practice-take'
import { Button } from '@/shared/ui'

/** Lane assignment and take rules (§9.2), shown between takes. */
export function PracticeOptions() {
  const pattern = usePracticeTake((s) => s.pattern)
  const laneRoles = usePracticeTake((s) => s.laneRoles)
  const lanePresetId = usePracticeTake((s) => s.lanePresetId)
  const laneStage = usePracticeTake((s) => s.laneStage)
  const waitMode = usePracticeTake((s) => s.waitMode)
  const strictStop = usePracticeTake((s) => s.strictStop)
  const strictHands = usePracticeTake((s) => s.strictHands)
  const tempoLadder = usePracticeTake((s) => s.tempoLadder)
  const status = usePracticeTake((s) => s.status)

  const setLanePreset = usePracticeTake((s) => s.setLanePreset)
  const toggleLane = usePracticeTake((s) => s.toggleLane)
  const setWaitMode = usePracticeTake((s) => s.setWaitMode)
  const setStrictStop = usePracticeTake((s) => s.setStrictStop)
  const setStrictHands = usePracticeTake((s) => s.setStrictHands)
  const setTempoLadder = usePracticeTake((s) => s.setTempoLadder)

  const preset = LANE_PRESETS.find((candidate) => candidate.id === lanePresetId)
  const locked = status === 'running'

  return (
    <div className="session__options">
      <div className="session__panel">
        <span className="session__panel-label">Who plays what</span>
        <select
          className="tbar__select"
          value={lanePresetId}
          disabled={locked}
          aria-label="Lane preset"
          onChange={(event) => setLanePreset(event.target.value)}
        >
          {LANE_PRESETS.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.label}
            </option>
          ))}
          {lanePresetId === 'custom' && <option value="custom">Custom</option>}
        </select>

        {preset?.stages ? (
          <>
            <Button
              disabled={locked || laneStage === 0}
              onClick={() => setLanePreset(lanePresetId, laneStage - 1)}
              aria-label="Previous stage"
            >
              ◀
            </Button>
            <span className="session__stage">
              Stage {laneStage + 1}/{preset.stages}
            </span>
            <Button
              disabled={locked || laneStage >= preset.stages - 1}
              onClick={() => setLanePreset(lanePresetId, laneStage + 1)}
              aria-label="Next stage"
            >
              ▶
            </Button>
          </>
        ) : null}

        {preset && <span className="session__hint">{preset.description}</span>}
      </div>

      <div className="session__panel">
        <span className="session__panel-label">Lanes</span>
        {(pattern?.lanes ?? []).map((voice) => (
          <Button
            key={voice}
            aria-pressed={laneRoles[voice] === 'user'}
            disabled={locked}
            onClick={() => toggleLane(voice)}
          >
            {VOICE_META[voice].label}
            <span className="session__hint">{laneRoles[voice] === 'user' ? 'you' : 'app'}</span>
          </Button>
        ))}
      </div>

      <div className="session__panel">
        <span className="session__panel-label">Rules</span>
        <Button aria-pressed={waitMode} disabled={locked} onClick={() => setWaitMode(!waitMode)}>
          Wait mode
        </Button>
        <Button aria-pressed={strictHands} disabled={locked} onClick={() => setStrictHands(!strictHands)}>
          Strict hands
        </Button>
        <Button aria-pressed={tempoLadder} disabled={locked} onClick={() => setTempoLadder(!tempoLadder)}>
          Tempo ladder
        </Button>
        <Button aria-pressed={strictStop} disabled={locked} onClick={() => setStrictStop(!strictStop)}>
          {strictStop ? 'Strict: stop on 8 misses' : 'No-fail'}
        </Button>
      </div>
    </div>
  )
}
