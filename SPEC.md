# Drum Pad Trainer — Product & Technical Specification

**Status:** Draft v1 · 2026-08-23
**Platform:** Web app (desktop browser) + 4×4 MIDI pad controller

---

## 1. Overview & goals

A browser-based drum trainer driven by a 4×4 MIDI pad controller. The app teaches real drum-set vocabulary (grooves, variations, fills) on a finger-drumming pad layout, through three pillars:

1. **Animated pattern visualization** — a synchronized pair of views: a *sequencer (score) grid* showing which voice plays on which subdivision, and a *pad view* showing exactly which physical pads to strike at each step (the two halves of the reference screenshots).
2. **Practice mode** — the user plays along on the connected controller; the app judges every hit for pad accuracy and timing and gives real-time visual feedback.
3. **Gamified drills** — a structured curriculum of patterns with pass criteria, stars, XP, streaks, and tempo goals, so variety and speed are earned progressively.

### Goals (v1)

- Load a pattern and play an animated, audible demonstration at any tempo, perfectly in sync.
- Accept live MIDI input, judge it against the pattern, and score the performance.
- Ship a starter curriculum (the three reference patterns plus ~12 drills) with a progression loop that makes daily practice sticky.

### Non-goals (v1)

- Mobile support (Web MIDI is unavailable on iOS Safari).
- User accounts / cloud sync (local persistence only; export/import instead).
- A pattern *editor* UI (patterns ship as JSON; editing is a v2 candidate).
- Notated sheet music (staff notation). The grid **is** the notation.

---

## 2. Definitions

| Term | Meaning |
|---|---|
| **Voice** | A drum sound: Kick, Snare, Sidestick, Hi Hat (closed), Open HH, Ride, Cymbal A/B/C, Low/Mid/High Tom. |
| **Pad** | A physical location on the 4×4 controller, addressed as `(row, col)` with row 1 at the top. Several pads may map to the same voice. |
| **Pattern** | A loopable phrase: one or more bars at a fixed subdivision. |
| **Step** | One cell of the timeline. In 4/4: 8 steps/bar for 8th-note patterns, 16 for 16th-note patterns. |
| **Hit** | One scheduled note: `(bar, step, voice, hand, flags)`. |
| **Hand marker** | The glyph on a hit: **circle = lead hand**, **diamond = alternate hand**. Each maps to a *different physical pad* of the same voice (e.g. the two Hi Hat pads), which is how alternating 16th-note hi-hats are taught. |
| **Count label** | The text under/above each step (`1 e & a…` for 16ths; the reference material labels 8ths as `1 a 2 a…`). Stored per pattern, not hardcoded. |
| **Transport** | The playback engine: owns tempo, position, start/stop/loop, and the master clock. |
| **Judgment** | The result of matching one user hit against one expected hit: Perfect / Good / Early / Late / Miss / Wrong-pad / Extra. |

---

## 3. Platform & compatibility

| Environment | Support | Notes |
|---|---|---|
| Chrome / Edge / Chromium (desktop) | **Primary target** | Full Web MIDI + Web Audio. |
| Firefox (desktop) | Best effort | Web MIDI behind site permission; verify in M2. |
| Safari | Degraded | No Web MIDI → keyboard-input fallback only, with a visible notice. |
| Mobile | Out of scope v1 | Layout should not break, but no support commitment. |

**Input fallback (all browsers):** the 4×4 grid maps to the keyboard block `1234 / QWER / ASDF / ZXCV` (top row → bottom row). This keeps every mode usable without hardware and enables automated testing.

---

## 4. Pad layout & MIDI mapping

### 4.1 Default 4×4 layout

Row 1 is the top row, as printed on the controller overlay:

| | col 1 | col 2 | col 3 | col 4 |
|---|---|---|---|---|
| **row 1** | Low Tom | Mid Tom | High Tom | Cymbal A |
| **row 2** | Hi Hat | Open HH | Hi Hat | Ride |
| **row 3** | Sidestick | Snare | Snare | Sidestick |
| **row 4** | Cymbal B | Kick | Kick | Cymbal C |

Design rationale (preserve this in any future re-mapping presets):

- **Mirrored core.** The backbeat voices (Snare, Kick) are duplicated in the two center columns so either hand can play them.
- **Two Hi Hat pads** (cols 1 and 3 of row 2) enable alternating-hands 16th notes: lead hand on one pad, alternate hand on the other.
- **Outer columns are "colors"**: cymbals and sidesticks at the edges, toms across the top — mimicking a drum kit's spatial logic (kick low, cymbals high/outside).

### 4.2 Voice → pad resolution

A hit specifies a **voice + hand**, not a raw pad. The mapping layer resolves it:

- Each voice has an ordered pad list: `[leadPad, altPad?]`. Default: the **right-hand instance is the lead pad** (e.g. Hi Hat lead = `(2,3)`, alt = `(2,1)`; Snare lead = `(3,3)`, alt = `(3,2)`; Kick lead = `(4,3)`, alt = `(4,2)`).
- `hand: "R"` → lead pad, `hand: "L"` → alt pad. A left-handed toggle in Settings swaps the convention globally.
- Voices with a single pad ignore the hand for pad resolution (the marker still renders, for sticking guidance).

**Judging leniency:** by default, a hit on *any* pad of the correct voice counts (lenient). Drills in the "Hands & sticking" track may set `strictHands: true`, requiring the exact pad.

### 4.3 MIDI note mapping

- **Presets:** General MIDI drum map (Kick 36, Sidestick 37, Snare 38, Closed HH 42, Open HH 46, Ride 51, Crash 49/57, Toms 45/47/50) and a chromatic 36–51 pad preset (common MPD/Launchpad default, bottom-left = 36, ascending left→right, bottom→top).
- **Learn wizard (required feature):** the app prompts pad by pad — "Hit the **Low Tom** pad (top-left)" — and records the incoming note number for each of the 16 positions. Stored per MIDI device name; auto-selected on reconnect.
- Multiple note numbers may map to one pad (some controllers send different notes per bank).
- **Velocity** is recorded on every hit (0–127) for later dynamics features; v1 uses it only for playback volume of the user's own hits and an optional ghost-note threshold.

---

## 5. Pattern data model

Patterns are static JSON files shipped as seed data in `src/entities/pattern/seeds/` (see §13.1), validated against the schema below.

```ts
type Voice =
  | "kick" | "snare" | "sidestick"
  | "hihat" | "openhat" | "ride"
  | "cymbalA" | "cymbalB" | "cymbalC"
  | "tomLow" | "tomMid" | "tomHigh";

type Hand = "R" | "L";

interface Hit {
  bar: number;          // 0-based
  step: number;         // 0-based index within the bar
  voice: Voice;
  hand?: Hand;          // default "R"
  accent?: boolean;     // render larger / play louder
  ghost?: boolean;      // render smaller / play softer
}

interface Pattern {
  id: string;           // slug, e.g. "basic-8th-beat"
  title: string;        // "Basic 8th note beat"
  level: number;        // curriculum tier
  timeSig: [number, number];   // [4, 4]
  subdivision: 8 | 16;  // steps per bar (4/4)
  bars: number;         // usually 1
  bpmDefault: number;   // e.g. 80
  bpmRange: [number, number];  // e.g. [50, 160]
  countLabels: string[];       // per step: ["1","a","2","a",...] or ["1","e","&","a",...]
  lanes: Voice[];       // score-view row order, top → bottom
  hits: Hit[];
  drill?: {
    targetBpm: number;          // BPM at which stars are earned
    starAccuracy: [number, number, number]; // % for 1★/2★/3★, e.g. [70, 85, 95]
    strictHands?: boolean;
    notes?: string;             // coaching tip shown before the drill
  };
}
```

### 5.1 Seed patterns (from the reference screenshots)

**Basic 8th note beat** — 8 steps, counts `1 a 2 a 3 a 4 a`:

| Voice | 1 | a | 2 | a | 3 | a | 4 | a |
|---|---|---|---|---|---|---|---|---|
| Hi Hat | ● | ● | ● | ● | ● | ● | ● | ● |
| Snare | | | ● | | | | ● | |
| Kick | ● | | | | ● | | | |

**Basic 16th note beat** — 16 steps, counts `1 e & a …`; hi-hat alternates hands: lead (●) on `1 & 2 &…`, alternate (◆) on every `e` and `a`:

| Voice | 1 | e | & | a | 2 | e | & | a | 3 | e | & | a | 4 | e | & | a |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hi Hat | ● | ◆ | ● | ◆ | ● | ◆ | ● | ◆ | ● | ◆ | ● | ◆ | ● | ◆ | ● | ◆ |
| Snare | | | | | ● | | | | | | | | ● | | | |
| Kick | ● | | | | | | | | ● | | | | | | | |

**Variation #1** — 8 steps; open hi-hat replaces the closed hat on the final `a`, with extra kicks:

| Voice | 1 | a | 2 | a | 3 | a | 4 | a |
|---|---|---|---|---|---|---|---|---|
| Open HH | | | | | | | | ● |
| Hi Hat | ● | ● | ● | ● | ● | ● | ● | |
| Snare | | | ● | | | | ● | |
| Kick | ● | | | | ● | ● | | ● |

Example JSON (Variation #1):

```json
{
  "id": "variation-1",
  "title": "Variation #1",
  "level": 3,
  "timeSig": [4, 4],
  "subdivision": 8,
  "bars": 1,
  "bpmDefault": 80,
  "bpmRange": [50, 150],
  "countLabels": ["1", "a", "2", "a", "3", "a", "4", "a"],
  "lanes": ["openhat", "hihat", "snare", "kick"],
  "hits": [
    { "bar": 0, "step": 0, "voice": "hihat" },
    { "bar": 0, "step": 0, "voice": "kick" },
    { "bar": 0, "step": 1, "voice": "hihat" },
    { "bar": 0, "step": 2, "voice": "hihat" },
    { "bar": 0, "step": 2, "voice": "snare" },
    { "bar": 0, "step": 3, "voice": "hihat" },
    { "bar": 0, "step": 4, "voice": "hihat" },
    { "bar": 0, "step": 4, "voice": "kick" },
    { "bar": 0, "step": 5, "voice": "hihat" },
    { "bar": 0, "step": 5, "voice": "kick" },
    { "bar": 0, "step": 6, "voice": "hihat" },
    { "bar": 0, "step": 6, "voice": "snare" },
    { "bar": 0, "step": 7, "voice": "openhat" },
    { "bar": 0, "step": 7, "voice": "kick" }
  ],
  "drill": { "targetBpm": 90, "starAccuracy": [70, 85, 95] }
}
```

---

## 6. Visualization & animation

Three synchronized views render the same pattern. All animation is driven by the transport clock (§7.3) — never by CSS timers or `setInterval` — so visuals cannot drift from audio.

### 6.1 Sequencer (score) view

The top grid of the screenshots.

- **Header row:** one cell per step with its count label; downbeats (`1 2 3 4`) visually heavier than subdivisions.
- **One row per lane** (order from `pattern.lanes`), with a colored row label. Voice colors are fixed app-wide tokens:
  - Hi Hat **orange** · Open HH **blue** · Snare **purple** · Kick **green** · Ride **teal** · Sidestick **magenta** · Toms **warm gradient (low→high)** · Cymbals **gold**.
- **Tokens:** circle = lead hand, diamond = alternate hand; accent renders ~15% larger, ghost ~30% smaller and hollow. Empty steps are light-grey cells.
- **Playback animation:**
  - The current step's *column* highlights (darker background + outline) and steps forward discretely.
  - Tokens in the active column pulse once: scale 1 → 1.25 → 1 over ~120 ms, synced to the audible hit.
  - Optional smooth playhead bar sweeping continuously across the bar (Settings toggle; discrete column is the default because it matches the counting).

### 6.2 Pad filmstrip

The bottom half of the screenshots: **one mini 4×4 frame per step**, captioned with the spoken count (`One, e, &, a, Two…`).

- Each frame shows the pads struck on that step: **red filled circle** for lead-hand hits, **orange diamond** for alternate-hand hits, on the grey 4×4 silhouette.
- Static rendering (no playback) must reproduce the screenshots exactly — this doubles as printable/learnable material.
- **Playback animation:** the current frame lifts (scale ~1.06, stronger shadow, accent border); past frames dim slightly until the loop restarts. Frames never move horizontally — the eye tracks the highlight, not a scrolling strip.
- On narrow viewports the strip collapses to a large **"Now / Next"** pair of frames.

### 6.3 Live pad view

A single large 4×4 mirroring the physical controller (labels included). Used in Practice mode; optional in Watch mode.

- **Demo playback:** pads flash in their voice color on each hit, decaying over ~150 ms.
- **Practice cues:** each upcoming hit shows an **approach ring** — a ring that shrinks onto the target pad over exactly one beat, reaching the pad edge at the moment the hit is due. This is the timing cue (rhythm-game "note highway" collapsed onto the pad itself).
- **Hit feedback:** correct → white/green flash on the pad + judgment label (§10); wrong pad → red flash on the struck pad while the expected pad outlines; miss → the expected pad leaves a hollow fading ring.

### 6.4 Animation rules (all views)

- Rendered via `requestAnimationFrame`, positions computed from `transport.position` each frame.
- Only `transform` and `opacity` animate (compositor-friendly, 60 fps target).
- `prefers-reduced-motion`: pulses and rings become opacity changes only; filmstrip lift becomes a border highlight.
- Latency budget: audible hit ↔ visual pulse within one frame (≤ 16 ms).

---

## 7. Audio engine

### 7.1 Sampler

- Web Audio API. One-shot samples per voice (44.1 kHz, short tails), preloaded and decoded at app start; total kit ≤ 2 MB.
- Per-voice gain, master gain, velocity → gain curve.
- **Hi-hat choke group:** a closed Hi Hat hit chokes a ringing Open HH (fast 30 ms fade), as on a real kit.
- Distinct metronome click (accented beat 1) that cuts through the kit.

### 7.2 What sounds when

- **Watch mode:** the app plays every hit.
- **Practice mode:** the app plays the *backing* (metronome + any lanes assigned to "auto"); the **user's own pads always trigger their sample live** on MIDI note-on (direct monitoring, < 10 ms from event to sound — do not route user sounds through the scheduler).

### 7.3 Transport & scheduler

- Master clock = `AudioContext.currentTime`. The transport converts `(bar, step)` ↔ seconds from BPM and subdivision.
- **Lookahead scheduler:** a 25 ms interval timer schedules all events falling in the next 100 ms window at exact AudioContext timestamps (standard "Tale of Two Clocks" pattern). Guarantees sample-accurate audio regardless of main-thread jank.
- The transport exposes `position` (continuous, in steps) and emits `step` events for UI state; the UI reads `position` on rAF for smooth elements.
- Count-in: 1 bar of metronome before every take (configurable 0/1/2).
- Tempo changes apply at the next bar boundary while playing; immediately when stopped.

---

## 8. MIDI input & calibration

### 8.1 Device handling

- `navigator.requestMIDIAccess()` on first entry to any playing screen; device picker listing inputs; hot-plug via `statechange` (auto-reconnect to last device, toast on disconnect mid-session).
- Note-on with velocity > 0 = hit (note-on velocity 0 treated as note-off, ignored). Note-off ignored in v1.
- **Debounce:** ignore retriggers of the same note within 30 ms (pad double-fire protection).

### 8.2 Timestamps

- Use the MIDI event's `timeStamp` (DOMHighResTimeStamp) — not arrival time — mapped into transport time via a `performance.now()` ↔ `AudioContext.currentTime` anchor captured at transport start. All judging happens in transport time.

### 8.3 Latency calibration (onboarding step, re-runnable in Settings)

1. App plays a steady quarter-note click for 16 beats; user plays any pad along with it.
2. Offset per hit = hit time − nearest click time; device offset = **median** of hits 5–16.
3. Stored per device; applied as a constant correction to every judged hit. Typical values 5–40 ms.
4. Sanity check: if spread (IQR) > 60 ms, warn and offer a retry instead of storing garbage.

---

## 9. Modes

### 9.1 Watch mode (learn)

The animated demonstration — the screenshots brought to life.

- Transport controls: play/pause, loop (default on), BPM slider across `bpmRange`, tap-tempo.
- **Step-through:** with transport stopped, arrow keys / pad hits advance one step at a time, all three views updating — for slow decoding of a new pattern.
- Voice **mute/solo** per lane (listen to just kick + snare, etc.).
- A/B loop: select a step range to loop (relevant for multi-bar patterns).

### 9.2 Practice mode (play along)

- **Lane assignment:** each lane is `user` or `auto`. Presets: "Everything", "Kick only", "Hands only (hats+snare)", "Add one limb at a time".
- **Wait mode:** transport pauses at each user step until the correct pad is struck (Synthesia-style); no timing judgment, pure sequence learning.
- **Tempo ladder:** after N consecutive clean loops (default 2 loops ≥ 90 % accuracy), BPM auto-increases by 5 until the user fails, tracking a session-best.
- **No-fail** by default; a strict toggle stops the take after 8 consecutive misses.
- Live HUD: combo counter, rolling accuracy %, per-hit judgment labels.

### 9.3 Drill mode (assessed)

A drill = a pattern + fixed settings (target BPM, lane assignment, strictness) + pass criteria. One take = count-in + 4 loops (configurable per drill). Produces a score, grade, and stars (§10–§11). Retry instantly with `R`.

---

## 10. Judging & scoring

### 10.1 Matching

On each user hit: resolve note → pad → voice, apply calibration offset, then find the nearest unmatched expected hit *of that voice* (or exact pad if `strictHands`) within the Miss window. Each expected hit matches at most one user hit; surplus hits are **Extra**.

### 10.2 Timing windows

Fixed-ms windows, clamped so they never overlap neighboring steps at high tempo:

| Judgment | Window | Clamp |
|---|---|---|
| Perfect | ± 35 ms | ≤ ± 40 % of step duration |
| Good | ± 70 ms | ≤ ± 45 % of step duration |
| Miss | outside Good | — |

Early/Late direction is recorded on every non-Perfect judgment and drives the rushing/dragging feedback (§10.4).

### 10.3 Score

- Perfect = 100, Good = 60, Miss = 0. Wrong-pad = 0 and breaks combo. Extra = −10 (floor at 0; disabled in Level-1 drills).
- Combo: consecutive Perfect/Good hits; multiplier ×1 → ×4 (steps at 10/25/50).
- **Accuracy %** = earned points / max points (combo excluded) — this is the star metric, so it is comparable across patterns.
- Grade: S ≥ 97 % · A ≥ 92 % · B ≥ 85 % · C ≥ 75 % · D below.

### 10.4 Results screen

- Grade, accuracy, max combo, stars earned, best BPM (if tempo ladder ran).
- **Timing histogram** (hits bucketed by signed offset) with a verdict: "you're rushing the backbeat by ~20 ms".
- **Weak-spot callout:** the step×voice cell with the worst average — "the `a` of 3 (kick) needs work" — with a one-tap **"Drill that step"** that opens Practice mode A/B-looped around it.

---

## 11. Progression & gamification

### 11.1 Curriculum

Tracks of ordered drills; each drill: **Watch → Guided (wait mode) → Assessed**.

| Track | Contents (seed) |
|---|---|
| 1 · Foundations | Single-voice timing drills; Basic 8th note beat; kick/snare independence. |
| 2 · Sixteenths & hands | Alternating-hands hat drills; Basic 16th note beat; `strictHands` variants. |
| 3 · Colors | Open HH accents (Variation #1); ride swap; sidestick grooves. |
| 4 · Fills & toms | 1-beat and 2-beat tom fills appended to learned grooves. |
| 5 · Tempo mastery | Earlier patterns at escalating target BPMs. |

- Stars: 1★/2★/3★ at the drill's `starAccuracy` thresholds **at target BPM**. Below target BPM, accuracy still shows but stars are locked.
- Progression gate: the next track unlocks at an average of 2★ across the current one (soft gate — a "peek ahead" preview stays available in Watch mode).

### 11.2 Meta-game

- **XP** per take (score-scaled), level curve purely cosmetic.
- **Daily streak** (any assessed take counts) + weekly goal (default 5 takes; configurable).
- **Practice heatmap** calendar on the dashboard.
- **Speed trophies:** per pattern, personal-best BPM at ≥ 90 % accuracy, displayed on its library card.
- **Badges:** First 3★, 50-combo, 100 Perfects in a day, track cleared, 7-day streak, "Ambidextrous" (3★ on a strictHands drill), etc. Badges are additive-only; nothing is ever lost.

---

## 12. Screens & flows

```
Onboarding (first run):
  Connect controller → Mapping (preset or Learn wizard) → Calibration → First drill

Main navigation:
  Dashboard ── Library ── Session ── Results ── Settings
```

- **Dashboard:** streak, weekly goal, heatmap, "continue where you left off", next recommended drill.
- **Library:** tracks → drill cards (title, level, stars, speed trophy, lock state).
- **Session:** the core screen. Sequencer view on top; filmstrip *or* live pad view below (toggle; Practice defaults to live pad, Watch defaults to filmstrip); transport bar (play, loop, BPM, mode switcher, lane assignment) docked at the bottom.
- **Results:** §10.4.
- **Settings:** MIDI device + mapping wizard, calibration, left-handed swap, audio kit & volumes, timing strictness, count-in, appearance (theme, reduced motion), data export/import (JSON).

---

## 13. Architecture & tech stack

- **Stack:** Vite + TypeScript + React. State via zustand (small, subscription-based — suits high-frequency transport reads). Plain CSS with custom properties (design tokens); no CSS framework.
- **Architecture:** the codebase natively follows **Feature-Sliced Design (FSD)** — layers → slices → segments, with the standard FSD import discipline (§13.2).
- **Rendering:** DOM/CSS for all grids (a 16×6 grid and 16 mini-grids are trivial for the compositor). Canvas/WebGL explicitly *not* needed in v1.
- **No backend.** Static hosting (any CDN). Progress in `localStorage` (schema-versioned, migratable); patterns bundled as JSON.

### 13.1 FSD layout

Six layers (the deprecated `processes` layer is not used). One slice per domain concept or user scenario; segments inside each slice are the standard `ui / model / lib / api / config`.

```
src/
  app/                    # initialization: providers, router, global styles, error boundary
  pages/                  # route-level composition only — no logic of their own
    onboarding/  dashboard/  library/  session/  results/  settings/
  widgets/                # self-sufficient UI blocks composed on pages
    sequencer/            # score grid + playhead + token pulses (§6.1)
    filmstrip/            # per-step 4×4 frames + now/next collapse (§6.2)
    live-pad/             # controller mirror, approach rings, hit feedback (§6.3)
    transport-bar/        # play/loop/BPM/tap-tempo/mode switcher/lane assignment
    practice-hud/         # combo, rolling accuracy, judgment labels
    results-panel/        # grade, timing histogram, weak-spot callout (§10.4)
    progress-heatmap/     # practice calendar (§11.2)
  features/               # one user scenario per slice
    watch-playback/       # demo playback, step-through, mute/solo, A/B loop (§9.1)
    practice-take/        # lane assignment, wait mode, tempo ladder, no-fail (§9.2)
    assess-drill/         # fixed-settings take → score/grade/stars outcome (§9.3)
    map-controller/       # mapping presets + pad-by-pad learn wizard (§4.3)
    calibrate-latency/    # click-along calibration flow (§8.3)
    transfer-progress/    # export / import progress JSON (§14)
  entities/               # domain models — framework-free TypeScript
    pattern/              # Pattern/Hit types, schema validation, seed JSON, voice color tokens
    take/                 # judge + scorer as pure functions (§10), take/judgment types
    drill/                # drill config, star thresholds, curriculum/track data (§11.1)
    progress/             # stars, XP, streaks, badges + persistence model
    device/               # per-device note→pad mapping and calibration records
  shared/                 # infrastructure — no business logic, no upward knowledge
    lib/audio/            # sampler, choke groups, metronome, lookahead scheduler (§7)
    lib/midi/             # Web MIDI wrapper, keyboard fallback, 30 ms debounce (§8.1)
    lib/transport/        # master clock, (bar,step) ↔ seconds math, position events (§7.3)
    lib/persist/          # versioned localStorage access + migration shim (§14)
    ui/                   # buttons, chips, sliders, dialogs, layout primitives
    config/               # design tokens, timing-window constants, keyboard map
```

Placement rules that keep the domain honest:

- The **transport, scheduler, sampler, and MIDI access are infrastructure**, so they live in `shared/lib` — they know nothing about patterns or drills; they move time, schedule buffers, and emit note events.
- The **judge and scorer are domain logic**, so they live in `entities/take` as pure functions over plain data (expected hits, user hits with timestamps, config) — the FSD-native home of the old "engine is pure" rule, exhaustively unit-testable with simulated clocks.
- **Zustand stores sit in the `model` segment of the slice that owns the state**: session/transport UI state in `features/*/model`, progress in `entities/progress/model`, device records in `entities/device/model`.
- Widgets are **presentation + composition**: they read feature/entity models and render; they never talk to `shared/lib/midi` or the scheduler directly.

### 13.2 Import discipline

- **Downward-only imports:** `app → pages → widgets → features → entities → shared`. A layer may import from any layer below it, never from its own layer or above.
- **No cross-imports between slices of the same layer.** The one sanctioned exception is FSD's `@x` notation for declared entity relations (e.g. `entities/take` consumes `Pattern` types via `entities/pattern/@x/take`).
- **Every slice exposes a public API** (`index.ts`); deep imports into segments are forbidden.
- Enforced in CI with **Steiger** (the FSD linter) plus an ESLint boundaries rule — violations fail the build, not code review.

### 13.3 Testing

- **Vitest** for `entities/take` (judging windows incl. clamping, scoring, matching) and `shared/lib` (scheduler math, transport conversions, calibration median/IQR).
- **Virtual MIDI dev tool** (dev-only slice `features/virtual-midi`): a debug panel that replays scripted note events with programmable offsets — powers e2e tests (Playwright) and lets a developer without hardware simulate a "sloppy" or "perfect" take.
- Golden-file test on `widgets/filmstrip`: static render of the three seed patterns vs. reference snapshots (guards the screenshot-fidelity requirement in §6.2).

---

## 14. Persistence

- `settings` (device, mapping per device, calibration per device, preferences).
- `progress` (per drill: stars, best accuracy, best BPM, attempt count; XP, streak data, badges).
- All in `localStorage` under versioned keys with a migration shim; **Export / Import** as a single JSON file in Settings (also the backup story until cloud sync exists).

---

## 15. Non-functional requirements

- Audio scheduling jitter < 2 ms (guaranteed by lookahead scheduling, verified by test).
- User pad → monitored sound < 10 ms of app-added latency; → visual feedback ≤ 1 frame.
- 60 fps during playback with all views animating (mid-range laptop).
- Initial load < 2 s on broadband including the drum kit samples.
- Fully keyboard-operable; visible focus states; color-blind safe (voice identity is always color **+ shape/label**, never color alone); `prefers-reduced-motion` respected (§6.4).

---

## 16. Milestones & acceptance criteria

### M1 — "It plays" (visualization + audio)

Pattern model + validation; audio engine + scheduler; sequencer view + filmstrip with full playback animation; Watch mode complete; 3 seed patterns.
**Accept:** Variation #1 plays 2 minutes looped at 60 and 140 BPM with no audible jitter and visuals synced within one frame; static filmstrip matches the reference screenshots; mute/solo and step-through work.

### M2 — "It listens" (input + practice)

Web MIDI + learn wizard + calibration; keyboard fallback; Practice mode (lane assignment, wait mode, tempo ladder); judging + scoring; live pad view with approach rings; Results screen.
**Accept:** with the virtual-MIDI tool scripted at +20 ms constant offset and calibration applied, a "perfect" scripted take scores ≥ 99 %; wrong-pad and extra hits are classified per §10; disconnecting the controller mid-take pauses gracefully.

### M3 — "It teaches" (drills + meta-game)

Curriculum data (≥ 12 drills across tracks 1–3); stars/gating; XP, streaks, heatmap, badges, speed trophies; Dashboard + Library; onboarding flow.
**Accept:** a new user can go from first launch to completing the first assessed drill without touching documentation; progress survives reload; export → wipe → import restores everything.

### M4 — Stretch

Pattern editor, additional kits, PWA offline, cloud sync/accounts, tom-fill generator, multi-bar songs ("play the whole 8-bar loop").

---

## 17. Risks & open questions

| Risk / question | Mitigation / default |
|---|---|
| Safari has no Web MIDI | Keyboard fallback + prominent "use Chrome" notice; do not block M1 on it. |
| Controller latency varies wildly | Calibration is mandatory in onboarding, re-runnable, per device. |
| Pad double-triggering | 30 ms same-note debounce (§8.1). |
| Sample licensing | Use CC0/self-recorded one-shots; keep the kit swappable behind the sampler interface. |
| Strict vs. lenient hand judging | Default lenient; strict only where the drill teaches sticking (§4.2). |
| Count-label conventions differ (`1 a` vs `1 &`) | Labels are pattern data, not code (§5); seed data follows the reference material. |
| Web MIDI permission UX | Request access only on first Session screen entry, never on landing. |
