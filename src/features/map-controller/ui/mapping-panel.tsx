import { DevicePanel } from './device-panel'
import { NoteMapPanel } from './note-map-panel'

/** Device choice and note map together — the Settings view (§12). */
export function MappingPanel() {
  return (
    <div className="session__options">
      <DevicePanel />
      <NoteMapPanel />
    </div>
  )
}
