import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { CalibrationPanel } from '@/features/calibrate-latency'
import { MappingPanel } from '@/features/map-controller'
import {
  beatSeconds,
  pendingExpected,
  practiceNow,
  usePracticeTake,
} from '@/features/practice-take'
import {
  createVirtualPlayer,
  seededRandom,
  VirtualMidiPanel,
  type PlayStyle,
  type VirtualPlayer,
} from '@/features/virtual-midi'
import { getPadInput, useDeviceStore } from '@/entities/device'
import { getDrill } from '@/entities/drill'
import { pendingDrillExpected, useAssessDrill } from '@/features/assess-drill'
import { getAudioEngine, getTransport } from '@/shared/lib/runtime'
import {
  audioAvailable,
  connectWatchPlayback,
  isVoiceAudible,
  useCountInBeats,
  usePlayheadPosition,
  usePlayheadStep,
  useWatchHotkeys,
  useWatchPlayback,
} from '@/features/watch-playback'
import { displayLabels, usePatternDisplay } from '@/entities/pattern'
import type { Judgment } from '@/entities/take'
import { Filmstrip } from '@/widgets/filmstrip'
import { LivePad, type PadCue, type PadFeedback } from '@/widgets/live-pad'
import { PracticeHud } from '@/widgets/practice-hud'
import { ResultsPanel } from '@/widgets/results-panel'
import { Sequencer } from '@/widgets/sequencer'
import { TransportBar, type SessionMode } from '@/widgets/transport-bar'
import { Button } from '@/shared/ui'
import { DrillMode } from './drill-mode'
import { PracticeOptions } from './practice-options'
import './session-page.css'

/** Map a judgment onto what the pad grid should show (§6.3). */
function feedbackFor(judgment: Judgment | undefined): PadFeedback | undefined {
  if (!judgment) return undefined
  switch (judgment.grade) {
    case 'perfect':
    case 'good':
      return judgment.hit ? { pad: judgment.hit.pad, kind: 'good' } : undefined
    case 'wrongPad':
      return judgment.hit
        ? {
            pad: judgment.hit.pad,
            kind: 'bad',
            ...(judgment.expected ? { expectedPad: judgment.expected.pad } : {}),
          }
        : undefined
    case 'extra':
      return judgment.hit ? { pad: judgment.hit.pad, kind: 'bad' } : undefined
    case 'miss':
      return judgment.expected ? { pad: judgment.expected.pad, kind: 'missed' } : undefined
    default:
      return undefined
  }
}

/** The core screen (§12): sequencer on top, filmstrip or live pad below,
 *  transport docked. */
export function SessionPage() {
  const { drillId } = useParams()
  const [searchParams] = useSearchParams()
  const drill = drillId ? getDrill(drillId) : undefined
  const requestedMode = searchParams.get('mode')
  // A locked track opens in Watch mode only — the soft gate from §11.1.
  const previewOnly = requestedMode === 'watch'

  const [mode, setMode] = useState<SessionMode>(() =>
    requestedMode === 'drill' && drillId ? 'drill' : 'watch',
  )
  const [compact, setCompact] = useState(false)
  const virtualPlayer = useRef<VirtualPlayer | null>(null)

  const pattern = useWatchPlayback((s) => s.pattern)
  const index = useWatchPlayback((s) => s.index)
  const range = useWatchPlayback((s) => s.range)
  const muted = useWatchPlayback((s) => s.muted)
  const soloed = useWatchPlayback((s) => s.soloed)
  const smoothPlayhead = useWatchPlayback((s) => s.smoothPlayhead)
  const bpm = useWatchPlayback((s) => s.bpm)
  const toggleMute = useWatchPlayback((s) => s.toggleMute)
  const toggleSolo = useWatchPlayback((s) => s.toggleSolo)
  const seekToStep = useWatchPlayback((s) => s.seekToStep)
  const setRange = useWatchPlayback((s) => s.setRange)
  const resetRange = useWatchPlayback((s) => s.resetRange)

  const practiceStatus = usePracticeTake((s) => s.status)
  const interruption = usePracticeTake((s) => s.interruption)
  const connectMidi = useDeviceStore((s) => s.connect)
  const preparePractice = usePracticeTake((s) => s.prepare)
  const stopTake = usePracticeTake((s) => s.stop)
  const retryTake = usePracticeTake((s) => s.retry)
  const clearResult = usePracticeTake((s) => s.clearResult)
  const stats = usePracticeTake((s) => s.stats)
  const lastJudgment = usePracticeTake((s) => s.lastJudgment)
  const waitingFor = usePracticeTake((s) => s.waitingFor)
  const result = usePracticeTake((s) => s.result)
  const sessionBestBpm = usePracticeTake((s) => s.sessionBestBpm)
  const injectStrike = usePracticeTake((s) => s.injectStrike)

  const loadDrill = useAssessDrill((s) => s.load)
  const loadPattern = useWatchPlayback((s) => s.loadPattern)

  // Opening a drill loads its pattern into the session (§9.3).
  useEffect(() => {
    if (!drill) return
    loadPattern(drill.patternId)
    loadDrill(drill.id)
  }, [drill, loadDrill, loadPattern])

  const counting = usePatternDisplay((s) => s.counting)
  const labels = useMemo(() => displayLabels(index, counting), [index, counting])

  const activeStep = usePlayheadStep()
  const getPosition = usePlayheadPosition()
  const countInBeats = useCountInBeats()
  const isPractice = mode === 'practice'
  const isDrill = mode === 'drill'
  useWatchHotkeys(mode === 'watch')

  // Web MIDI is requested on entry to a playing screen, never on landing (§17).
  useEffect(() => {
    if (!isPractice) return
    void connectMidi()
  }, [isPractice, connectMidi])

  // Only one mode drives the transport's step events at a time.
  useEffect(() => {
    if (!audioAvailable() || mode !== 'watch') return
    return connectWatchPlayback()
  }, [mode])

  useEffect(() => {
    if (!isPractice) return
    preparePractice(pattern)
    return () => stopTake()
  }, [isPractice, pattern, preparePractice, stopTake])

  // Retry the take with R, as §9.3 asks.
  useEffect(() => {
    if (!isPractice) return
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyR' || event.metaKey || event.ctrlKey) return
      const node = event.target as HTMLElement | null
      if (node && ['INPUT', 'SELECT', 'TEXTAREA'].includes(node.tagName)) return
      void retryTake()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isPractice, retryTake])

  /** Dev tool (§13.3): play the running take for us, in a chosen style. */
  const runScripted = useCallback(
    (style: PlayStyle) => {
      if (!audioAvailable()) return
      virtualPlayer.current?.stop()
      const player = createVirtualPlayer({
        input: getPadInput(),
        transport: getTransport(),
        clock: getAudioEngine().clock,
      })
      virtualPlayer.current = player
      // Practice and Drill each run their own take, so follow whichever is live.
      const getPending = isDrill ? pendingDrillExpected : pendingExpected
      player.follow({ getPending, style, random: seededRandom(1) })
    },
    [isDrill],
  )

  useEffect(() => {
    if (practiceStatus === 'running') return
    virtualPlayer.current?.stop()
  }, [practiceStatus])

  const getCues = useCallback(
    (nowSec: number): PadCue[] =>
      pendingExpected().map((hit) => ({
        pad: hit.pad,
        voice: hit.voice,
        secondsUntil: hit.time - nowSec,
      })),
    [],
  )
  const horizonSec = useMemo(() => beatSeconds(), [bpm])
  const feedback = feedbackFor(lastJudgment)
  const isAudible = (voice: Parameters<typeof isVoiceAudible>[1]) =>
    isVoiceAudible({ muted, soloed }, voice)

  return (
    <div className="session">
      <header className="session__head">
        <h1 className="session__title">{drill?.title ?? pattern.title}</h1>
        <span className="session__level">Level {pattern.level}</span>
        <span className="session__meta">
          {pattern.timeSig[0]}/{pattern.timeSig[1]} · {pattern.subdivision === 16 ? '16th' : '8th'} notes ·{' '}
          {pattern.bpmRange[0]}–{pattern.bpmRange[1]} BPM
        </span>
        {drill && (
          <span className="session__level">
            Drill · target {drill.targetBpm} BPM{drill.strictHands ? ' · strict hands' : ''}
          </span>
        )}
        {previewOnly && <span className="session__level">Preview</span>}
        {(drill?.notes ?? pattern.drill?.notes) && (
          <p className="session__notes">{drill?.notes ?? pattern.drill?.notes}</p>
        )}
      </header>

      {!audioAvailable() && (
        <p className="session__notice">
          This browser has no Web Audio support, so playback is disabled. Use a Chromium-based
          desktop browser for the full experience (§3).
        </p>
      )}

      <div className="session__views">
        <Sequencer
          index={index}
          activeStep={activeStep}
          labels={labels}
          range={range}
          isAudible={isAudible}
          soloed={soloed}
          onToggleMute={isPractice ? undefined : toggleMute}
          onToggleSolo={isPractice ? undefined : toggleSolo}
          onStepClick={isPractice ? undefined : seekToStep}
          smoothPlayhead={smoothPlayhead}
          getPosition={getPosition}
        />

        {isDrill ? (
          <DrillMode
            index={index}
            onDrillWeakSpot={(step) => {
              setRange(step, step + 1)
              setMode('practice')
            }}
            {...(import.meta.env.DEV ? { onRunScripted: runScripted } : {})}
          />
        ) : isPractice ? (
          <>
            <PracticeHud
              stats={stats}
              lastJudgment={lastJudgment}
              bpm={bpm}
              sessionBestBpm={sessionBestBpm}
            />
            {result ? (
              <ResultsPanel
                result={result}
                index={index}
                bestBpm={sessionBestBpm}
                onRetry={() => void retryTake()}
                onDrillWeakSpot={(step) => {
                  setRange(step, step + 1)
                  clearResult()
                }}
                onDismiss={clearResult}
              />
            ) : (
              <>
                {interruption === 'device-disconnected' && (
                  <p className="session__notice" role="alert">
                    The controller disconnected, so the take was ended. Reconnect it and press R to
                    try again — the keyboard fallback works in the meantime.
                  </p>
                )}
                <PracticeOptions />
                <MappingPanel />
                <div className="session__panel">
                  <CalibrationPanel />
                </div>
                {import.meta.env.DEV && (
                  <VirtualMidiPanel
                    onRun={runScripted}
                    disabled={practiceStatus !== 'running'}
                  />
                )}
                <LivePad
                  getCues={getCues}
                  getNow={practiceNow}
                  horizonSec={horizonSec}
                  waitingFor={waitingFor}
                  feedback={feedback}
                  onPadDown={(pad) =>
                    practiceStatus === 'running' &&
                    injectStrike({
                      pad,
                      voice: undefined,
                      velocity: 100,
                      timeStamp: performance.now(),
                      source: 'keyboard',
                    })
                  }
                />
              </>
            )}
          </>
        ) : (
          <>
            <div className="session__panel">
              <span className="session__panel-label">A/B loop</span>
              <Button onClick={() => setRange(activeStep, range[1])}>Set A ({range[0] + 1})</Button>
              <Button onClick={() => setRange(range[0], activeStep + 1)}>Set B ({range[1]})</Button>
              <Button onClick={resetRange}>Whole pattern</Button>
              <span style={{ flex: 1 }} />
              <Button aria-pressed={compact} onClick={() => setCompact(!compact)}>
                Now / Next
              </Button>
            </div>

            <Filmstrip
              index={index}
              activeStep={activeStep}
              labels={labels}
              range={range}
              compact={compact}
              onStepClick={seekToStep}
            />
          </>
        )}
      </div>

      <div className="session__dock">
        <TransportBar
          mode={mode}
          onModeChange={setMode}
          drillAvailable={drill !== undefined}
          previewOnly={previewOnly}
        />
      </div>

      {countInBeats > 0 && (
        <div className="session__countin" aria-live="polite">
          {countInBeats}
        </div>
      )}
    </div>
  )
}
