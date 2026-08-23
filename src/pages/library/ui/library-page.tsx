import type { CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  drillsInTrack,
  isTrackUnlocked,
  TRACKS,
  TRACK_UNLOCK_STARS,
  type Drill,
} from '@/entities/drill'
import { VOICE_META, voiceColor } from '@/entities/pattern'
import { averageStarsFor, useProgress } from '@/entities/progress'
import './library-page.css'

function Stars({ earned }: { earned: number }) {
  return (
    <span
      className={`card__stars${earned > 0 ? ' card__stars--earned' : ''}`}
      aria-label={`${earned} of 3 stars`}
    >
      {'★'.repeat(earned)}
      {'☆'.repeat(3 - earned)}
    </span>
  )
}

function DrillCard({ drill, locked }: { drill: Drill; locked: boolean }) {
  const progress = useProgress((s) => s.progress.drills[drill.id])
  const stars = progress?.stars ?? 0

  const card = (
    <>
      <div className="card__head">
        <span className="card__title">{drill.title}</span>
        <span className="card__order">{drill.order}</span>
      </div>
      <div className="card__meta">
        <Stars earned={stars} />
        {drill.strictHands && <span className="card__strict">strict hands</span>}
      </div>
      <div className="card__meta">
        <span>target {drill.targetBpm} BPM</span>
        {progress && progress.bestBpm > 0 && (
          <span className="card__trophy" title="Personal best tempo at 90 % or better">
            🏆 {progress.bestBpm}
          </span>
        )}
        {progress && progress.attempts > 0 && <span>best {Math.round(progress.bestAccuracy)}%</span>}
      </div>
      {drill.focus && (
        <div className="card__focus" aria-hidden="true">
          {drill.focus.map((voice) => (
            <span
              key={voice}
              className="card__dot"
              style={{ '--voice': voiceColor(voice) } as CSSProperties}
              title={VOICE_META[voice].label}
            />
          ))}
        </div>
      )}
    </>
  )

  // A locked track is a soft gate (§11.1): the drill still opens, in Watch
  // mode, so the curriculum can always be previewed.
  return (
    <Link
      className={`card${locked ? ' card--locked' : ''}`}
      to={`/session/${drill.id}${locked ? '?mode=watch' : ''}`}
    >
      {card}
    </Link>
  )
}

/** Tracks and their drill cards (§12). */
export function LibraryPage() {
  const progress = useProgress((s) => s.progress)

  return (
    <div className="library">
      <p className="library__intro">
        Work down a track in order. Stars are earned at the drill's target tempo — below it your
        accuracy still shows, but the stars stay locked. The next track opens at an average of{' '}
        {TRACK_UNLOCK_STARS}★.
      </p>

      {TRACKS.map((track, index) => {
        const drills = drillsInTrack(track.id)
        const previous = index === 0 ? undefined : TRACKS[index - 1]
        const previousAverage = previous
          ? averageStarsFor(progress, drillsInTrack(previous.id).map((d) => d.id))
          : 3
        const unlocked = isTrackUnlocked(track.index, previousAverage)
        const average = averageStarsFor(progress, drills.map((d) => d.id))

        return (
          <section className="track" key={track.id} aria-label={track.title}>
            <div className="track__head">
              <span className="track__index">Track {track.index}</span>
              <h2 className="track__title">{track.title}</h2>
              {!unlocked && <span className="track__lock">Preview — {TRACK_UNLOCK_STARS}★ to unlock</span>}
              <span className="track__progress">{average.toFixed(1)}★ avg</span>
              <p className="track__summary">{track.summary}</p>
            </div>
            <div className="cards">
              {drills.map((drill) => (
                <DrillCard key={drill.id} drill={drill} locked={!unlocked} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
