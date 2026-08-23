import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPadInput, type PadStrike } from '@/entities/device'
import type { ExpectedHit } from '@/entities/take'
import { intervalTickSource } from '@/shared/lib/audio'
import { runFor, TestClock } from '@/shared/lib/testing'
import { Transport } from '@/shared/lib/transport'
import { PERFECT_PLAYER } from '../lib/script'
import { createVirtualPlayer } from './player'

const PAD = { row: 4, col: 3 }

function expectedAt(times: number[]): ExpectedHit[] {
  return times.map((time, i) => ({
    id: `0:${i}:kick`,
    voice: 'kick' as const,
    hand: 'R' as const,
    pad: PAD,
    time,
    patternStep: i,
    loop: 0,
  }))
}

function harness() {
  const clock = new TestClock()
  const perfClock = new TestClock(300)
  const transport = new Transport({
    clock,
    perfClock,
    tickSource: intervalTickSource(),
    anchorSource: () => ({ perfSec: perfClock.now(), audioSec: clock.now() }),
    bpm: 120,
    subdivision: 8,
    timeSig: [4, 4],
    bars: 1,
  })
  const input = createPadInput({ getMapping: () => ({}), keyboardTarget: new EventTarget() })
  const received: PadStrike[] = []
  input.on('strike', (strike) => received.push(strike))

  const player = createVirtualPlayer({
    input,
    transport,
    clock,
    tickSource: intervalTickSource(),
    intervalMs: 5,
  })

  /** Both clocks move together, as they do in a browser. Jumping one ahead of
   *  the other would make an anchor taken mid-walk meaningless. */
  const advance = (seconds: number) => {
    const slices = Math.ceil(seconds / 0.005)
    for (let i = 0; i < slices; i++) {
      perfClock.advance(0.005)
      runFor(clock, 0.005, 5)
    }
  }
  return { clock, perfClock, transport, input, player, received, advance }
}

describe('virtual MIDI player (§13.3)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits each scripted strike once its moment arrives', () => {
    const h = harness()
    h.player.play([
      { pad: PAD, voice: 'kick', velocity: 100, time: 0.1 },
      { pad: PAD, voice: 'kick', velocity: 100, time: 0.3 },
    ])

    h.advance(0.05)
    expect(h.received).toHaveLength(0)
    h.advance(0.1)
    expect(h.received).toHaveLength(1)
    h.advance(0.2)
    expect(h.received).toHaveLength(2)
    h.player.stop()
  })

  it('stamps each strike with its scripted time, not the delivery time', () => {
    const h = harness()
    // Delivered on a 5 ms pulse, so delivery is necessarily late.
    h.player.play([{ pad: PAD, voice: 'kick', velocity: 100, time: 0.111 }])
    h.advance(0.2)

    const strike = h.received[0]
    expect(strike).toBeDefined()
    if (!strike) return
    // Mapping the stamp back through the transport recovers the exact moment.
    expect(h.transport.perfToAudioTime(strike.timeStamp)).toBeCloseTo(0.111, 9)
    h.player.stop()
  })

  it('follows a live take, playing notes as the judge registers them', () => {
    const h = harness()
    let pending: ExpectedHit[] = []
    h.player.follow({ getPending: () => pending, style: PERFECT_PLAYER })

    // Notes appear progressively, as the scheduler's lookahead reaches them.
    pending = expectedAt([0.1, 0.2])
    h.advance(0.25)
    expect(h.received).toHaveLength(2)

    pending = [...pending, ...expectedAt([0.4]).map((hit) => ({ ...hit, id: 'later' }))]
    h.advance(0.25)
    expect(h.received).toHaveLength(3)
    h.player.stop()
  })

  it('never plays the same note twice', () => {
    const h = harness()
    const pending = expectedAt([0.1])
    h.player.follow({ getPending: () => pending, style: PERFECT_PLAYER })
    h.advance(0.5)
    expect(h.received).toHaveLength(1)
    h.player.stop()
  })

  it('drops notes it was handed too late instead of firing them in a burst', () => {
    const h = harness()
    h.advance(1)
    let pending: ExpectedHit[] = []
    h.player.follow({ getPending: () => pending, style: PERFECT_PLAYER })
    // Every one of these is long past.
    pending = expectedAt([0.1, 0.2, 0.3])
    h.advance(0.1)
    expect(h.received).toHaveLength(0)
    h.player.stop()
  })

  it('keeps running while following, and stops on demand', () => {
    const h = harness()
    h.player.follow({ getPending: () => [], style: PERFECT_PLAYER })
    h.advance(0.5)
    expect(h.player.running).toBe(true)
    h.player.stop()
    expect(h.player.running).toBe(false)
  })

  it('finishes a fixed script and reports done', () => {
    const h = harness()
    const done = vi.fn()
    const clock = new TestClock()
    const player = createVirtualPlayer({
      input: h.input,
      transport: h.transport,
      clock: h.clock,
      onDone: done,
      tickSource: intervalTickSource(),
      intervalMs: 5,
    })
    void clock
    player.play([{ pad: PAD, voice: 'kick', velocity: 100, time: 0.05 }])
    h.advance(0.2)
    expect(done).toHaveBeenCalled()
    expect(player.running).toBe(false)
  })
})
