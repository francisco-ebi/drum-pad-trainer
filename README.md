# Drum Pad Trainer

A browser-based drum trainer driven by a 4×4 MIDI pad controller.
See [SPEC.md](SPEC.md) for the full product and technical specification.

**Current milestone: M3 — "It teaches"** (curriculum, progression, meta-game).
M1 ("It plays") and M2 ("It listens") are complete.

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

## What M3 ships so far

- **Curriculum** (§11.1) — `entities/drill`: three tracks and thirteen drills over
  twelve patterns, with stars at the drill's target tempo and the soft 2★ track
  gate. Drills are separate from patterns, so one pattern can carry both a
  lenient introduction and a strict-hands variant.
- **Progression** (§11.2) — `entities/progress`: stars, XP and levels, the daily
  streak, the weekly goal, badges and speed trophies, all persisted under a
  versioned key. Everything recorded is a high-water mark — a bad take never
  costs you what you already earned.
- **Assessed drills** (§9.3) — `features/assess-drill`: a take under the drill's
  fixed rules for a fixed number of loops, producing stars and a progress entry.
  An interrupted take is shown but never recorded.
- **Dashboard and Library** (§12) — level, streak, weekly goal, practice heatmap,
  badges and "continue where you left off"; tracks and drill cards with stars,
  speed trophies and lock state.
- **Settings** (§12) — device, mapping, calibration, left-handed swap, weekly
  goal, and export / import / erase (§14).
- **Routing** — `react-router-dom`, with the basename from `import.meta.env.BASE_URL`
  and a `404.html` fallback so deep links survive GitHub Pages.

- **Onboarding** (§12) — a first-time visitor is sent to a guided flow: connect →
  map → calibrate → first drill, ending on the drill already in Drill mode. The
  mapping step is dropped for keyboard players, since there is no note map to
  fill. Every step before the last can be skipped, and Settings can re-run it.

### Still to do for M3

- **Results as its own route** (§12). It currently renders in place on the
  Session screen, which works but is not the screen the spec describes.
- Tracks 4 (fills & toms) and 5 (tempo mastery) from §11.1 are declared but not
  seeded; fills need tom patterns that are not authored yet.

## What M2 ships

- **MIDI input** (§8.1) — `shared/lib/midi`: Web MIDI wrapper with device list,
  hot-plug, note-on extraction and the 30 ms same-note debounce, plus the
  keyboard fallback (`1234 / QWER / ASDF / ZXCV`) that keeps every mode usable
  without hardware.
- **Timestamp anchor** (§8.2) — the transport pairs the `performance.now()` and
  `AudioContext` timelines at each start, preferring `getOutputTimestamp()` so a
  hit is judged against the audio the player actually heard.
- **Mapping** (§4.3) — `entities/device`: General MIDI and chromatic-36 presets,
  plus the pad-by-pad learn wizard, stored per device name.
- **Calibration** (§8.3) — click-along run, median of the settled hits, and an
  IQR sanity check that refuses to store an inconsistent run.
- **Judging and scoring** (§10) — `entities/take`: one streaming judge drives
  both the live HUD and the results screen, so the two can never disagree.
  Perfect/Good/Miss/Wrong-pad/Extra, tempo-clamped windows, combo multipliers,
  accuracy and letter grades.
- **Practice mode** (§9.2) — lane assignment presets, wait mode, tempo ladder,
  no-fail and strict stop, live HUD, and a graceful end if the controller
  vanishes mid-take.
- **Live pad view** (§6.3) — approach rings driven from the audio clock, hit and
  wrong-pad feedback, keyboard letters on each pad.
- **Results** (§10.4) — grade, timing histogram, rushing/dragging verdict, and
  the weak-spot callout with "drill that step".
- **Virtual MIDI dev tool** (§13.3) — scripts a take in a chosen style and plays
  it into the live input, stamped with exact times.

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
  app/                 shell, router, global styles, error boundary
  pages/               dashboard · library · session · settings
  widgets/             sequencer · filmstrip · live-pad · transport-bar
                       practice-hud · results-panel · progress-heatmap
  features/            watch-playback · practice-take · assess-drill
                       map-controller · calibrate-latency · transfer-progress
                       virtual-midi (dev)
  entities/            pattern · device · take · drill · progress
  shared/              lib/{audio,transport,midi,persist,testing} · ui · config
```

The take runner lives in `entities/take` alongside the judge it drives, because
Practice and Drill are two scenarios over the same machinery — and features may
not import each other.

`widgets/sequencer` and `widgets/filmstrip` are purely presentational: every
animated value arrives as a prop, which is what makes the filmstrip's static
render snapshot-testable against the reference material.

## Testing

`yarn test` covers transport scheduling (exact step times, loop wrap, tempo
changes at the bar line, count-in, A/B range, step-through), the performance ↔
audio anchor, the pattern schema, seed fidelity against the §5.1 tables, pad
resolution and note mapping, calibration statistics, the judge and scorer, and a
golden-file render of the filmstrip (ASCII 4×4 per step, in `__snapshots__`).

Two suites are worth knowing about:

- `features/practice-take/lib/scripted-take.test.ts` is the **M2 acceptance
  criterion** (§16): a take scripted at +20 ms with calibration applied scores
  100 %, and wrong-pad, extra and miss are each classified per §10.
- `features/practice-take/model/session.test.ts` drives a **whole live take**
  against hand-cranked clocks — the transport, the performance timeline the
  input is stamped on, and the frame pump are all controlled, so the timing
  assertions are exact rather than approximate.

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

- See "Still to do for M3" above.
- **No browser e2e run yet.** Playwright and the browser-mode Vitest environment
  are still outstanding; the Web Audio rendering assertions in
  `synth-kit.test.ts` are `skipIf`-guarded until then.
- **Timing work runs off the main thread's frame loop.** The scheduler, the take's
  settle pass and the virtual-MIDI player all pulse from a worker timer rather
  than `requestAnimationFrame`, so a take keeps time and finishes correctly in a
  background tab. Only drawing uses frames.
