import type { Track, TrackId } from '../model/types'

/**
 * Curriculum tracks (§11.1). Tracks 4 and 5 are declared so the progression
 * model and the library know the shape of what is coming, but they carry no
 * drills yet — fills need tom patterns that are not authored, and tempo
 * mastery is best built once the earlier tracks have real play data.
 */
export const TRACKS: readonly Track[] = [
  {
    id: 'foundations',
    index: 1,
    title: 'Foundations',
    summary: 'Single-voice timing, the basic beat, and kick/snare independence.',
  },
  {
    id: 'sixteenths',
    index: 2,
    title: 'Sixteenths & hands',
    summary: 'Alternating hands, sixteenth-note grooves, and strict sticking.',
  },
  {
    id: 'colors',
    index: 3,
    title: 'Colors',
    summary: 'Open hats, the ride, and sidestick — the same grooves in new voices.',
  },
]

/** Tracks named in §11.1 that have no drills yet. */
export const PLANNED_TRACK_IDS: readonly TrackId[] = ['fills', 'tempo']

export function getTrack(id: TrackId): Track | undefined {
  return TRACKS.find((track) => track.id === id)
}
