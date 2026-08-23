# Drum Pad Trainer

A browser-based drum trainer driven by a 4×4 MIDI pad controller.
See [SPEC.md](SPEC.md) for the full product and technical specification.

**Current milestone: M1 — "It plays"** (visualisation + audio, Watch mode).

## Getting started

```bash
yarn install
yarn dev
```

| Script | What it does |
|---|---|
| `yarn dev` | Vite dev server |
| `yarn build` | Typecheck + production build |
| `yarn test` | Vitest suite |
| `yarn test:watch` | Vitest in watch mode |
| `yarn typecheck` | `tsc -b` across app and node configs |
| `yarn lint` | Steiger — fails on Feature-Sliced Design violations (§13.2) |

Chromium-based desktop browsers are the primary target (§3).

## What M1 ships

- **Pattern model + validation** (§5) — `entities/pattern`, with a hand-rolled schema
  validator; the three seed patterns are parsed through it at import, so bad data
  fails loudly instead of half-rendering.
- **Audio engine** (§7) — `shared/lib/audio`: a lookahead scheduler (25 ms tick,
  100 ms window) whose heartbeat runs on a worker thread, a buffer sampler with
  per-sound gain, a velocity curve and hi-hat choke groups, and a metronome bus.
- **Transport** (§7.3) — `shared/lib/transport`: the AudioContext master clock,
  `(bar, step) ↔ seconds` math, loop and A/B range, count-in, tempo changes that
  land on the next bar boundary, and step-through.
- **Sequencer view** (§6.1) and **pad filmstrip** (§6.2), both driven by
  `transport.position` on `requestAnimationFrame` — never by CSS timers.
- **Watch mode** (§9.1) — play/pause/loop, tempo slider + tap tempo, mute/solo per
  lane, step-through, A/B loop, count-in, metronome, optional smooth playhead.
- **Seed patterns** (§5.1) — Basic 8th note beat, Basic 16th note beat, Variation #1.

### The kit is synthesised, not sampled

M1 renders each voice offline into an `AudioBuffer` at start-up
(`shared/lib/audio/synth-kit.ts`) rather than loading recorded one-shots. The
sampler only plays buffers, so dropping in CC0 samples later (§17) changes the
loader, not the engine. Measured in Chrome at 44.1 kHz, the current bank peaks
between 0.38 and 0.86 — clip-free, with hats and cymbals under kick and snare.

## Architecture

Feature-Sliced Design, exactly as laid out in §13.1. Import direction is
`app → pages → widgets → features → entities → shared`, enforced by `yarn lint`;
cross-entity imports go through `@x` (e.g. `entities/pattern/@x/device`).

```
src/
  app/                 shell, global styles, error boundary
  pages/session/       the core screen (§12)
  widgets/             sequencer · filmstrip · transport-bar
  features/            watch-playback
  entities/            pattern · device
  shared/              lib/{audio,transport,testing} · ui · config
```

`widgets/sequencer` and `widgets/filmstrip` are purely presentational: every
animated value arrives as a prop, which is what makes the filmstrip's static
render snapshot-testable against the reference material.

## Testing

`yarn test` covers transport scheduling (exact step times, loop wrap, tempo
changes at the bar line, count-in, A/B range, step-through), the pattern schema,
seed fidelity against the §5.1 tables, pad resolution, and a golden-file render
of the filmstrip (ASCII 4×4 per step, in `__snapshots__`).

Audio rendering assertions are `skipIf`-guarded on `OfflineAudioContext` and so
are skipped under jsdom; they start running once the browser test environment
lands with M2's Playwright suite (§13.3).

### Why the scheduler ticks on a worker

Browsers clamp `setInterval` in hidden tabs, which would starve the scheduler's
100 ms lookahead window and drop audio the moment the user tabs away. Dedicated
workers are not clamped that way, so the heartbeat lives in
`shared/lib/audio/timer.worker.ts` and only the scheduling work runs on the main
thread — the standard fix for web audio clocks.

The timer is injectable (`TickSource`): the worker is the default, a main-thread
`setInterval` is the fallback where workers are unavailable, and tests inject the
interval source so fake timers can drive it deterministically. Swapping in an
AudioWorklet clock later is a change to one file behind that interface.

## Known gaps / follow-ups

- **MIDI timestamps.** §8.2 needs a `performance.now()` ↔ `AudioContext.currentTime`
  anchor captured at transport start, so judged hits land in transport time. The
  transport has no such anchor yet; it is additive, and belongs with M2's judging.
- No MIDI, judging, scoring, or Practice/Drill modes yet — those are M2 and M3.
- A single screen, no router; Dashboard / Library / Results arrive with M3 (§12).
