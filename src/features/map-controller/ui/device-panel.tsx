import { useDeviceStore } from '@/entities/device'
import { Button } from '@/shared/ui'

/**
 * Choosing a MIDI input (§8.1).
 *
 * Access is requested by the button, never on load — the browser prompts on
 * `requestMIDIAccess`, and that prompt should arrive because the user asked
 * for it (§17).
 */
export function DevicePanel() {
  const ports = useDeviceStore((s) => s.ports)
  const connection = useDeviceStore((s) => s.connection)
  const selectedPortId = useDeviceStore((s) => s.selectedPortId)
  const selectPort = useDeviceStore((s) => s.selectPort)
  const connect = useDeviceStore((s) => s.connect)

  if (connection === 'unsupported') {
    return (
      <div className="session__panel">
        <span className="session__panel-label">Controller</span>
        <span className="session__hint">
          This browser has no Web MIDI. The keyboard fallback (1234 / QWER / ASDF / ZXCV) works
          everywhere — use Chrome or Edge for a controller (§3).
        </span>
      </div>
    )
  }

  return (
    <div className="session__panel">
      <span className="session__panel-label">Controller</span>
      <Button onClick={() => void connect()}>
        {connection === 'connected' ? 'Rescan' : 'Connect MIDI'}
      </Button>
      <select
        className="tbar__select"
        aria-label="MIDI input"
        value={selectedPortId ?? ''}
        onChange={(event) => selectPort(event.target.value || undefined)}
      >
        <option value="">No device (keyboard only)</option>
        {ports.map((port) => (
          <option key={port.id} value={port.id}>
            {port.name}
          </option>
        ))}
      </select>
      {connection === 'denied' && (
        <span className="session__hint">
          MIDI access was declined. The keyboard fallback still works.
        </span>
      )}
      {connection !== 'denied' && ports.length === 0 && (
        <span className="session__hint">No inputs found yet — plug one in and rescan.</span>
      )}
    </div>
  )
}
