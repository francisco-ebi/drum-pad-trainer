import { activeRecord, CALIBRATION, useDeviceStore } from '@/entities/device'
import { Button } from '@/shared/ui'
import { useCalibration } from '../model/store'

/**
 * The click-along calibration flow (§8.3): play along with sixteen clicks,
 * and the median of the settled hits becomes the device's correction.
 */
export function CalibrationPanel() {
  const status = useCalibration((s) => s.status)
  const progress = useCalibration((s) => s.progress)
  const hitCount = useCalibration((s) => s.hitCount)
  const result = useCalibration((s) => s.result)
  const start = useCalibration((s) => s.start)
  const cancel = useCalibration((s) => s.cancel)
  const save = useCalibration((s) => s.save)

  const record = useDeviceStore(activeRecord)
  const deviceName = useDeviceStore((s) => s.activeDeviceName)

  return (
    <div className="session__panel">
      <span className="session__panel-label">Latency</span>

      {status === 'running' ? (
        <>
          <span className="session__hint">
            Play any pad on every click — {progress}/{CALIBRATION.clicks}, {hitCount} hits
          </span>
          <Button onClick={cancel}>Stop</Button>
        </>
      ) : (
        <Button onClick={() => void start()}>
          {record?.calibrationOffsetMs === undefined ? 'Calibrate' : 'Re-calibrate'}
        </Button>
      )}

      {status !== 'running' && record?.calibrationOffsetMs !== undefined && (
        <span className="session__hint">
          {deviceName}: {record.calibrationOffsetMs > 0 ? '+' : ''}
          {record.calibrationOffsetMs} ms
          {record.calibrationIqrMs !== undefined ? ` (spread ${record.calibrationIqrMs} ms)` : ''}
        </span>
      )}

      {status === 'done' && result && (
        <>
          {result.usable ? (
            <>
              <span className="session__hint">
                Measured {result.offsetMs > 0 ? '+' : ''}
                {result.offsetMs} ms over {result.sampleCount} hits.
              </span>
              <Button variant="primary" onClick={save}>
                Save
              </Button>
            </>
          ) : result.sampleCount < 4 ? (
            <span className="session__hint">
              Not enough hits to measure — play a pad on every click, right through to the end.
            </span>
          ) : (
            <span className="session__hint">
              Too inconsistent to store (spread {result.iqrMs} ms, limit {CALIBRATION.maxIqrMs} ms).
              Try again, playing right on the click.
            </span>
          )}
          <Button onClick={() => void start()}>Retry</Button>
        </>
      )}
    </div>
  )
}
