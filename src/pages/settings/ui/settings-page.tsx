import { useDeviceStore } from '@/entities/device'
import { DEFAULT_WEEKLY_GOAL, useProgress } from '@/entities/progress'
import { CalibrationPanel } from '@/features/calibrate-latency'
import { MappingPanel } from '@/features/map-controller'
import { TransferPanel } from '@/features/transfer-progress'
import { Button, Slider } from '@/shared/ui'
import '@/pages/session/ui/session-page.css'

/** Device, mapping, calibration, preferences and data (§12). */
export function SettingsPage() {
  const leftHanded = useDeviceStore((s) => s.leftHanded)
  const setLeftHanded = useDeviceStore((s) => s.setLeftHanded)
  const weeklyGoal = useProgress((s) => s.progress.weeklyGoal)
  const setWeeklyGoal = useProgress((s) => s.setWeeklyGoal)

  return (
    <div className="session">
      <header className="session__head">
        <h1 className="session__title">Settings</h1>
      </header>

      <div className="session__options">
        <MappingPanel />

        <div className="session__panel">
          <CalibrationPanel />
        </div>

        <div className="session__panel">
          <span className="session__panel-label">Playing</span>
          <Button aria-pressed={leftHanded} onClick={() => setLeftHanded(!leftHanded)}>
            Left-handed
          </Button>
          <span className="session__hint">
            Swaps which pad of a mirrored voice counts as the lead hand (§4.2).
          </span>
        </div>

        <div className="session__panel">
          <span className="session__panel-label">Weekly goal</span>
          <Slider
            label="Takes per week"
            value={weeklyGoal}
            min={1}
            max={30}
            display={`${weeklyGoal} takes`}
            onChange={setWeeklyGoal}
          />
          <span className="session__hint">Default is {DEFAULT_WEEKLY_GOAL}.</span>
        </div>

        <TransferPanel />
      </div>
    </div>
  )
}
