import { useRef, useState } from 'react'
import { Button } from '@/shared/ui'
import { backupFilename, buildBackup, parseBackup, restoreBackup, wipeProgress } from '../lib/transfer'

/** Export / import / wipe, as a single JSON file (§14). */
export function TransferPanel() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string>()
  const [confirmWipe, setConfirmWipe] = useState(false)

  const download = () => {
    const backup = buildBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = backupFilename()
    link.click()
    URL.revokeObjectURL(url)
    setMessage(`Exported ${Object.keys(backup.slices).length} section(s).`)
  }

  const upload = async (file: File) => {
    try {
      const { restored } = restoreBackup(parseBackup(await file.text()))
      setMessage(
        restored.length === 0
          ? 'That file held nothing this version recognises.'
          : `Restored ${restored.length} section(s). Reload to pick up device settings.`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read that file.')
    }
  }

  return (
    <div className="session__panel">
      <span className="session__panel-label">Your data</span>
      <Button onClick={download}>Export</Button>
      <Button onClick={() => fileInput.current?.click()}>Import</Button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
          event.target.value = ''
        }}
      />
      {confirmWipe ? (
        <>
          <span className="session__hint">Erase all stars, XP and streaks?</span>
          <Button
            onClick={() => {
              wipeProgress()
              setConfirmWipe(false)
              setMessage('Progress erased.')
            }}
          >
            Yes, erase
          </Button>
          <Button onClick={() => setConfirmWipe(false)}>Cancel</Button>
        </>
      ) : (
        <Button onClick={() => setConfirmWipe(true)}>Erase progress</Button>
      )}
      {message && <span className="session__hint">{message}</span>}
    </div>
  )
}
