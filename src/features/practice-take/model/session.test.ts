import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPadInput, type PadInput, type PadStrike } from '@/entities/device'
import { getPattern, indexPattern, type Pattern } from '@/entities/pattern'
import type { TakeResult } from '@/entities/take'
import { intervalTickSource } from '@/shared/lib/audio'
import { runFor, TestClock } from '@/shared/lib/testing'
import { Transport } from '@/shared/lib/transport'
import { buildLaneRoles } from '../lib/lane-roles'
import { PracticeSession, type PracticeSessionConfig, type TakeAudio, type PracticeUpdate } from './session'

function loadPattern(id: string): Pattern {
  const pattern = getPattern(id)
  if (!pattern) throw new Error(`Missing seed pattern ${id}`)
  return pattern
}

const variation = loadPattern('variation-1')
const BPM = 90

interface Played {
  id: string
  time: number | undefined
}

function fakeAudio(clock: TestClock): TakeAudio & { played: Played[]; clicks: number[] } {
  const played: Played[] = []
  const clicks: number[] = []
  return {
    played,
    clicks,
    clock,
    playMetronome: (time) => {
      clicks.push(time)
    },
    sampler: {
      play: (id, time) => {
        played.push({ id, time })
        return true
      },
    },
  }
}

/**
 * A take driven entirely by hand-cranked clocks: the audio clock, the
 * performance clock the input is stamped on, and the frame pump. Nothing here
 * depends on real time, so the timing assertions are exact.
 */
function harness(overrides: Partial<PracticeSessionConfig> = {}) {
  const clock = new TestClock()
  // Deliberately offset so a bug that conflates the two timelines cannot pass.
  const perfClock = new TestClock(500)
  const transport = new Transport({
    clock,
    perfClock,
    tickSource: intervalTickSource(),
    // Read both clocks directly; `getOutputTimestamp` is a browser concern.
    anchorSource: () => ({ perfSec: perfClock.now(), audioSec: clock.now() }),
    bpm: BPM,
    subdivision: variation.subdivision,
    timeSig: variation.timeSig,
    bars: variation.bars,
    startLeadSec: 0,
  })
  const audio = fakeAudio(clock)
  const updates: PracticeUpdate[] = []
  const loops: { loop: number; accuracy: number }[] = []
  let result: TakeResult | undefined

  const session = new PracticeSession(
    {
      index: indexPattern(variation),
      laneRoles: buildLaneRoles('everything', variation.lanes),
      strictHands: false,
      penalizeExtras: true,
      leftHanded: false,
      calibrationMs: 0,
      metronome: false,
      waitMode: false,
      strictStop: false,
      ...overrides,
    },
    {
      onUpdate: (update) => updates.push(update),
      onLoopComplete: (loop, accuracy) => loops.push({ loop, accuracy }),
      onFinish: (value) => {
        result = value
      },
    },
    { transport, audio },
  )

  const input: PadInput = createPadInput({
    getMapping: () => ({}),
    keyboardTarget: new EventTarget(),
  })

  /** Advance both clocks together and pump the session, as a frame loop would. */
  const advance = (seconds: number) => {
    const slices = Math.ceil(seconds / 0.005)
    for (let i = 0; i < slices; i++) {
      perfClock.advance(0.005)
      runFor(clock, 0.005, 5)
      session.pump(clock.now())
    }
  }

  /** Strike a pad, stamped on the performance timeline like a real event. */
  const strike = (pad: { row: number; col: number }, voice: string | undefined, audioTime: number) => {
    const value: PadStrike = {
      pad,
      voice: voice as PadStrike['voice'],
      velocity: 100,
      timeStamp: transport.audioToPerfTime(audioTime),
      source: 'midi',
    }
    input.emitStrike(value)
  }

  /**
   * The next note of a voice that is still ahead of the clock. Notes already
   * past their window have been settled as misses and cannot be played, so a
   * test must aim at one that is genuinely still coming.
   */
  const nextFuture = (voice?: string) => {
    for (let i = 0; i < 500; i++) {
      const hit = session.pendingExpected.find(
        (candidate) =>
          candidate.time > audio.clock.now() + 0.01 && (voice === undefined || candidate.voice === voice),
      )
      if (hit) return hit
      advance(0.02)
    }
    throw new Error(`No upcoming ${voice ?? 'note'} found`)
  }

  return {
    transport,
    audio,
    session,
    input,
    updates,
    loops,
    advance,
    strike,
    nextFuture,
    get result() {
      return result
    },
  }
}

const PADS = {
  hihat: { row: 2, col: 3 },
  openhat: { row: 2, col: 2 },
  snare: { row: 3, col: 3 },
  kick: { row: 4, col: 3 },
}

describe('live practice take', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('registers the notes the player owes as the transport schedules them', () => {
    const h = harness()
    h.session.start(h.input)
    h.advance(0.02)

    const pending = h.session.pendingExpected
    expect(pending.length).toBeGreaterThan(0)
    expect(pending[0]).toMatchObject({ patternStep: 0, loop: 0 })
    // Variation #1 opens with hi-hat and kick together.
    expect(pending.filter((hit) => hit.patternStep === 0).map((hit) => hit.voice).sort()).toEqual([
      'hihat',
      'kick',
    ])
    h.session.stop()
  })

  it('judges a hit stamped on the performance timeline as Perfect (§8.2 end to end)', () => {
    const h = harness()
    h.session.start(h.input)
    const target = h.nextFuture('kick')

    // Struck exactly on time, but expressed as an input timestamp.
    h.strike(PADS.kick, 'kick', target.time)
    const judgment = h.updates.at(-1)?.judgment
    expect(judgment?.grade).toBe('perfect')
    expect(judgment?.offsetSec ?? 1).toBeCloseTo(0, 6)
    h.session.stop()
  })

  it('reads a 50 ms late strike as Good and late', () => {
    const h = harness()
    h.session.start(h.input)
    const target = h.nextFuture('kick')

    h.strike(PADS.kick, 'kick', target.time + 0.05)
    expect(h.updates.at(-1)?.judgment).toMatchObject({ grade: 'good', direction: 'late' })
    h.session.stop()
  })

  it('cancels a constant device latency once calibration is applied (§8.3)', () => {
    const late = harness()
    late.session.start(late.input)
    const target = late.nextFuture('kick')
    // A device reporting 50 ms late reads as Good...
    late.strike(PADS.kick, 'kick', target.time + 0.05)
    expect(late.updates.at(-1)?.judgment?.grade).toBe('good')
    late.session.stop()

    // ...and Perfect once its offset is stored.
    const calibrated = harness({ calibrationMs: 50 })
    calibrated.session.start(calibrated.input)
    const target2 = calibrated.nextFuture('kick')
    calibrated.strike(PADS.kick, 'kick', target2.time + 0.05)
    const judgment = calibrated.updates.at(-1)?.judgment
    expect(judgment?.grade).toBe('perfect')
    expect(judgment?.offsetSec ?? 1).toBeCloseTo(0, 6)
    calibrated.session.stop()
  })

  it('plays a whole take cleanly and scores it S', () => {
    const h = harness()
    h.session.start(h.input)

    // Walk the loop, playing every note the moment it is registered.
    const struck = new Set<string>()
    for (let i = 0; i < 200; i++) {
      for (const hit of h.session.pendingExpected) {
        if (struck.has(hit.id)) continue
        if (hit.time > h.audio.clock.now() + 0.2) continue
        struck.add(hit.id)
        h.strike(hit.pad, hit.voice, hit.time)
      }
      h.advance(0.02)
    }

    const result = h.session.stop()
    expect(result.stats.counts.miss).toBe(0)
    expect(result.stats.counts.extra).toBe(0)
    expect(result.stats.accuracy).toBe(100)
    expect(result.grade).toBe('S')
    expect(result.stats.maxCombo).toBeGreaterThan(20)
  })

  it('lets the app play the lanes the player did not take (§9.2)', () => {
    const h = harness({ laneRoles: buildLaneRoles('kick-only', variation.lanes) })
    h.session.start(h.input)
    h.advance(1)

    // Only the kick is owed; the hats and snare are played for the user.
    expect(h.session.pendingExpected.every((hit) => hit.voice === 'kick')).toBe(true)
    expect(h.audio.played.some((sound) => sound.id === 'hihat')).toBe(true)
    expect(h.audio.played.some((sound) => sound.id === 'kick')).toBe(false)
    h.session.stop()
  })

  it('monitors the player’s own pad immediately, off the scheduler (§7.2)', () => {
    const h = harness()
    h.session.start(h.input)
    h.advance(0.1)
    h.audio.played.length = 0

    h.strike(PADS.snare, 'snare', h.audio.clock.now())
    const monitored = h.audio.played.find((sound) => sound.id === 'snare')
    expect(monitored).toBeDefined()
    // No scheduled time: it sounds now, not on the next scheduler window.
    expect(monitored?.time).toBeUndefined()
    h.session.stop()
  })

  it('turns unplayed notes into misses as their window closes', () => {
    const h = harness()
    h.session.start(h.input)
    h.advance(1.5)
    const stats = h.updates.at(-1)?.stats
    expect((stats?.counts.miss ?? 0)).toBeGreaterThan(0)
    h.session.stop()
  })

  it('stops the take after eight straight misses in strict mode (§9.2)', () => {
    const h = harness({ strictStop: true })
    h.session.start(h.input)
    h.advance(4)
    expect(h.result).toBeDefined()
    expect(h.result?.stats.counts.miss).toBeGreaterThanOrEqual(8)
    expect(h.transport.transportState).toBe('stopped')
  })

  it('plays on through misses when no-fail is on', () => {
    const h = harness({ strictStop: false })
    h.session.start(h.input)
    h.advance(4)
    expect(h.result).toBeUndefined()
    expect(h.transport.playing).toBe(true)
    h.session.stop()
  })

  it('scores each loop as it completes, for the tempo ladder (§9.2)', () => {
    const h = harness()
    h.session.start(h.input)
    const struck = new Set<string>()
    for (let i = 0; i < 300; i++) {
      for (const hit of h.session.pendingExpected) {
        if (struck.has(hit.id)) continue
        if (hit.time > h.audio.clock.now() + 0.2) continue
        struck.add(hit.id)
        h.strike(hit.pad, hit.voice, hit.time)
      }
      h.advance(0.02)
    }
    expect(h.loops.length).toBeGreaterThanOrEqual(1)
    expect(h.loops[0]?.accuracy).toBe(100)
    h.session.stop()
  })

  it('ends an assessed take after its fixed number of loops (§9.3)', () => {
    const h = harness({ maxLoops: 2 })
    h.session.start(h.input)
    h.advance(20)
    expect(h.result).toBeDefined()
    // Two passes of Variation #1's 14 notes.
    expect(h.result?.stats.expected).toBe(28)
  })
})

describe('wait mode (§9.2)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('holds on the first step until the right pads are struck', () => {
    const h = harness({ waitMode: true })
    h.session.start(h.input)

    // Step 0 of Variation #1 owes a hi-hat and a kick.
    const owed = () => h.updates.at(-1)?.waitingFor.map((target) => target.voice).sort() ?? []
    expect(owed()).toEqual(['hihat', 'kick'])
    expect(h.transport.playing).toBe(false)

    h.strike(PADS.hihat, 'hihat', 0)
    expect(owed()).toEqual(['kick'])
    expect(Math.round(h.transport.position)).toBe(0) // still holding

    h.strike(PADS.kick, 'kick', 0)
    // Step 1 is a lone hi-hat, so that is what it now waits for.
    expect(owed()).toEqual(['hihat'])
    expect(Math.round(h.transport.position)).toBe(1)
    h.session.stop()
  })

  it('ignores a wrong pad instead of advancing', () => {
    const h = harness({ waitMode: true })
    h.session.start(h.input)
    h.strike(PADS.snare, 'snare', 0)
    expect(h.updates.at(-1)?.waitingFor.map((t) => t.voice).sort()).toEqual(['hihat', 'kick'])
    expect(Math.round(h.transport.position)).toBe(0)
    h.session.stop()
  })

  it('scores nothing — it is sequence learning, not timing (§9.2)', () => {
    const h = harness({ waitMode: true })
    h.session.start(h.input)
    h.strike(PADS.hihat, 'hihat', 0)
    h.strike(PADS.kick, 'kick', 0)
    h.advance(2)
    const result = h.session.stop()
    expect(result.stats.expected).toBe(0)
    expect(result.judgments).toEqual([])
  })
})
