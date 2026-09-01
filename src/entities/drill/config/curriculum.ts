import { getPattern } from '@/entities/pattern/@x/drill'
import type { Drill } from '../model/types'

/** Default accuracy thresholds for 1★/2★/3★ (§11.1). */
const STARS: [number, number, number] = [70, 85, 95]

/** One assessed take is a count-in plus four loops (§9.3). */
const LOOPS = 4

/** Everything a drill must state, plus anything it chooses to override. */
type DrillSeed = Pick<Drill, 'id' | 'trackId' | 'patternId'> &
  Partial<Omit<Drill, 'id' | 'trackId' | 'patternId' | 'order'>>

/**
 * The seed curriculum (§11.1). Titles and star thresholds fall back to the
 * pattern's own drill block, so a drill only states what it changes.
 */
const SEEDS: DrillSeed[] = [
  // ---- Track 1 · Foundations ------------------------------------------------
  {
    id: 'foundations-quarter-kick',
    trackId: 'foundations',
    patternId: 'quarter-kick',
    focus: ['kick'],
  },
  {
    id: 'foundations-backbeat',
    trackId: 'foundations',
    patternId: 'backbeat-snare',
    focus: ['snare'],
  },
  {
    id: 'foundations-eighth-hats',
    trackId: 'foundations',
    patternId: 'eighth-hats',
    focus: ['hihat'],
  },
  {
    id: 'foundations-basic-beat',
    trackId: 'foundations',
    patternId: 'basic-8th-beat',
    focus: ['hihat', 'snare', 'kick'],
  },
  {
    id: 'foundations-independence',
    trackId: 'foundations',
    patternId: 'kick-snare-independence',
    focus: ['snare', 'kick'],
  },

  // ---- Track 2 · Sixteenths & hands ----------------------------------------
  {
    id: 'sixteenths-alternating-hats',
    trackId: 'sixteenths',
    patternId: 'alternating-hats-16',
    strictHands: true,
    focus: ['hihat'],
  },
  {
    id: 'sixteenths-basic-beat',
    trackId: 'sixteenths',
    patternId: 'basic-16th-beat',
    // Deliberately lenient, overriding the pattern's own default: learn the
    // groove first, then earn the sticking in the strict variant below (§4.2).
    strictHands: false,
    focus: ['hihat', 'snare', 'kick'],
  },
  {
    // Same pattern as the drill above, judged on sticking rather than voices —
    // the case that makes drills separate from patterns.
    id: 'sixteenths-basic-beat-strict',
    trackId: 'sixteenths',
    patternId: 'basic-16th-beat',
    title: 'Basic 16th note beat — strict hands',
    strictHands: true,
    starAccuracy: [65, 80, 92],
    focus: ['hihat'],
    notes: 'Every e and a must fall on the alternate hi-hat pad. Lead hand stays on the numbers.',
  },
  {
    id: 'sixteenths-pushed-kick',
    trackId: 'sixteenths',
    patternId: 'sixteenth-kick-variation',
    focus: ['kick'],
  },

  // ---- Track 3 · Colors -----------------------------------------------------
  {
    id: 'colors-variation-1',
    trackId: 'colors',
    patternId: 'variation-1',
    focus: ['openhat'],
  },
  {
    id: 'colors-ride',
    trackId: 'colors',
    patternId: 'ride-groove',
    focus: ['ride'],
  },
  {
    id: 'colors-sidestick',
    trackId: 'colors',
    patternId: 'sidestick-groove',
    focus: ['sidestick'],
  },
  {
    id: 'colors-open-hats',
    trackId: 'colors',
    patternId: 'open-hat-accents',
    focus: ['openhat'],
  },

  // ---- Track 4 · Fills & toms ----------------------------------------------
  {
    id: 'fills-snare-run',
    trackId: 'fills',
    patternId: 'fill-1-snare-run',
    focus: ['snare'],
  },
  {
    // The sticking is the lesson in a fill, so the run is re-run strictly once
    // the notes are under the hands (§4.2).
    id: 'fills-snare-run-strict',
    trackId: 'fills',
    patternId: 'fill-1-snare-run',
    title: 'Fill #1 — snare run, strict hands',
    strictHands: true,
    starAccuracy: [65, 80, 92],
    focus: ['snare'],
    notes: 'Same seven strokes, now judged on which snare pad each one lands on. Lead, alternate, lead…',
  },
  {
    id: 'fills-descending-toms',
    trackId: 'fills',
    patternId: 'fill-2-descending-toms',
    focus: ['tomHigh', 'tomMid', 'tomLow'],
  },
  {
    id: 'fills-snare-into-toms',
    trackId: 'fills',
    patternId: 'fill-3-snare-into-toms',
    focus: ['snare', 'tomMid', 'tomLow'],
  },

  // ---- Track 5 · Lo-fi & feel ----------------------------------------------
  {
    id: 'lofi-boom-bap',
    trackId: 'lofi',
    patternId: 'lofi-boom-bap',
    focus: ['kick', 'snare'],
  },
  {
    id: 'lofi-half-time',
    trackId: 'lofi',
    patternId: 'lofi-half-time',
    focus: ['snare'],
  },
  {
    id: 'lofi-ghost-notes',
    trackId: 'lofi',
    patternId: 'lofi-ghost-notes',
    focus: ['snare'],
  },
  {
    id: 'lofi-sidestick',
    trackId: 'lofi',
    patternId: 'lofi-sidestick',
    focus: ['sidestick', 'shaker'],
  },
  {
    id: 'lofi-open-hat',
    trackId: 'lofi',
    patternId: 'lofi-open-hat',
    focus: ['openhat'],
  },
]

function build(): Drill[] {
  const perTrack = new Map<string, number>()

  return SEEDS.map((seed) => {
    const pattern = getPattern(seed.patternId)
    if (!pattern) throw new Error(`Drill ${seed.id} references unknown pattern ${seed.patternId}`)

    const order = (perTrack.get(seed.trackId) ?? 0) + 1
    perTrack.set(seed.trackId, order)

    return {
      ...seed,
      order,
      title: seed.title ?? pattern.title,
      targetBpm: seed.targetBpm ?? pattern.drill?.targetBpm ?? pattern.bpmDefault,
      starAccuracy: seed.starAccuracy ?? pattern.drill?.starAccuracy ?? STARS,
      strictHands: seed.strictHands ?? pattern.drill?.strictHands ?? false,
      loops: seed.loops ?? LOOPS,
      notes: seed.notes ?? pattern.drill?.notes,
    } satisfies Drill
  })
}

export const DRILLS: readonly Drill[] = build()

export const DRILLS_BY_ID: ReadonlyMap<string, Drill> = new Map(
  DRILLS.map((drill) => [drill.id, drill]),
)

export function getDrill(id: string): Drill | undefined {
  return DRILLS_BY_ID.get(id)
}

export function drillsInTrack(trackId: string): Drill[] {
  return DRILLS.filter((drill) => drill.trackId === trackId).sort((a, b) => a.order - b.order)
}
