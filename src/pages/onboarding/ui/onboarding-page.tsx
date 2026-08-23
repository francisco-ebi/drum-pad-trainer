import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  activeRecord,
  KEYBOARD_DEVICE_NAME,
  isCalibrated,
  useDeviceStore,
} from '@/entities/device'
import { getDrill } from '@/entities/drill'
import { CalibrationPanel } from '@/features/calibrate-latency'
import { DevicePanel, NoteMapPanel } from '@/features/map-controller'
import { KEYBOARD_PAD_CODES } from '@/shared/config'
import { Button } from '@/shared/ui'
import { FIRST_DRILL_ID, onboardingSteps, type OnboardingStepId } from '../lib/steps'
import '@/pages/session/ui/session-page.css'
import './onboarding-page.css'

function KeyboardMap() {
  return (
    <div className="onb__keys" aria-label="Keyboard fallback layout">
      {KEYBOARD_PAD_CODES.flat().map((code) => (
        <span key={code} className="onb__key">
          {code.replace(/^(Key|Digit)/, '')}
        </span>
      ))}
    </div>
  )
}

/**
 * First-run flow (§12): connect → map → calibrate → first drill.
 *
 * Every step before the last can be skipped. A player with no controller, or
 * who would rather just hit something, should reach a drill in two clicks —
 * that is the point of the milestone's acceptance criterion.
 */
export function OnboardingPage() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)

  const connection = useDeviceStore((s) => s.connection)
  const deviceName = useDeviceStore((s) => s.activeDeviceName)
  const record = useDeviceStore(activeRecord)
  const complete = useDeviceStore((s) => s.completeOnboarding)

  const keyboardOnly = deviceName === KEYBOARD_DEVICE_NAME
  const steps = useMemo(
    () => onboardingSteps({ midiSupported: connection !== 'unsupported', keyboardOnly }),
    [connection, keyboardOnly],
  )
  // The step list shortens when the user stays on the keyboard, so clamp.
  const current = steps[Math.min(index, steps.length - 1)]
  const position = Math.min(index, steps.length - 1)
  const drill = getDrill(FIRST_DRILL_ID)

  const finish = (destination: string) => {
    complete()
    navigate(destination)
  }

  const body: Record<OnboardingStepId, React.ReactNode> = {
    connect: (
      <>
        <DevicePanel />
        <p className="onb__blurb">
          No controller? Everything works on the keyboard — these keys are the pads, top row to
          bottom.
        </p>
        <KeyboardMap />
      </>
    ),
    mapping: <NoteMapPanel />,
    calibration: (
      <>
        <div className="session__panel">
          <CalibrationPanel />
        </div>
        {isCalibrated(record) ? (
          <p className="onb__blurb">
            Calibrated. You can measure it again any time from Settings.
          </p>
        ) : (
          <p className="onb__blurb">
            Skip it for now if you like — hits are judged without a correction until you do, and
            Settings can run it later.
          </p>
        )}
      </>
    ),
    'first-drill': (
      <>
        <p className="onb__blurb">
          <strong>{drill?.title}</strong> — {drill?.notes}
        </p>
        <p className="onb__blurb">
          Press <strong>Drill</strong> on the bar at the bottom, then run the take. Four loops, and
          you get stars, a grade and a timing read-out.
        </p>
      </>
    ),
  }

  return (
    <div className="onb">
      {index === 0 && (
        <div className="onb__welcome">
          <h1>Welcome to Drum Pad Trainer</h1>
          <p>
            {steps.length} short {steps.length === 1 ? 'step' : 'steps'} and you will be playing your
            first drill.
          </p>
        </div>
      )}

      <div className="onb__rail" aria-label="Setup progress">
        {steps.map((step, stepIndex) => (
          <span
            key={step.id}
            className={`onb__pip${stepIndex === position ? ' is-current' : ''}${
              stepIndex < position ? ' is-done' : ''
            }`}
          >
            <span className="onb__pip-dot" aria-hidden="true">
              {stepIndex < position ? '✓' : stepIndex + 1}
            </span>
            {step.title}
            {stepIndex < steps.length - 1 && <span className="onb__rail-line" />}
          </span>
        ))}
      </div>

      <section className="onb__card" aria-label={current?.title}>
        <h2 className="onb__title">{current?.title}</h2>
        <p className="onb__blurb">{current?.blurb}</p>
        {current && body[current.id]}

        <div className="onb__actions">
          {position > 0 && <Button onClick={() => setIndex(position - 1)}>Back</Button>}
          <span className="onb__spacer" />
          {current?.skippable && (
            <Button onClick={() => setIndex(position + 1)}>Skip</Button>
          )}
          {current?.id === 'first-drill' ? (
            <Button variant="primary" onClick={() => finish(`/session/${FIRST_DRILL_ID}?mode=drill`)}>
              Start the drill
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setIndex(position + 1)}>
              Continue
            </Button>
          )}
        </div>
      </section>

      <button type="button" className="onb__skip-all" onClick={() => finish('/')}>
        Skip setup and go to the dashboard
      </button>
    </div>
  )
}
