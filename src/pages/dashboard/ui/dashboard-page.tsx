import { Link } from 'react-router-dom'
import { DRILLS, drillsInTrack, TRACKS } from '@/entities/drill'
import {
  BADGES,
  currentWeek,
  levelProgress,
  takesInDays,
  totalStars,
  useProgress,
} from '@/entities/progress'
import { ProgressHeatmap } from '@/widgets/progress-heatmap'
import { Button } from '@/shared/ui'
import './dashboard-page.css'

/**
 * The next drill to play: the first one in track order without three stars,
 * falling back to the very first drill for a brand-new user (§12).
 */
function useNextDrill() {
  const drills = useProgress((s) => s.progress.drills)
  for (const track of TRACKS) {
    for (const drill of drillsInTrack(track.id)) {
      if ((drills[drill.id]?.stars ?? 0) < 3) return drill
    }
  }
  return DRILLS[0]
}

/** Streak, weekly goal, heatmap and what to play next (§12, §11.2). */
export function DashboardPage() {
  const progress = useProgress((s) => s.progress)
  const next = useNextDrill()
  const level = levelProgress(progress.xp)

  const week = currentWeek(new Date())
  const thisWeek = takesInDays(progress, week)
  const goalFraction = Math.min(1, thisWeek / Math.max(1, progress.weeklyGoal))
  const earned = new Set(progress.badges)
  const stars = totalStars(progress)
  const maxStars = DRILLS.length * 3

  return (
    <div className="dash">
      <section className="dash__hero" aria-label="Your progress">
        <div className="dash__level">
          <span className="dash__label">Level</span>
          <div className="dash__level-line">
            <span className="dash__level-number">{level.level}</span>
            <span className="dash__sub">{progress.xp} XP</span>
          </div>
          <div className="dash__bar">
            <div className="dash__bar-fill" style={{ width: `${level.fraction * 100}%` }} />
          </div>
        </div>

        <div className="dash__stat">
          <span className="dash__label">Streak</span>
          <span className="dash__value">{progress.streak.current}</span>
          <span className="dash__sub">best {progress.streak.longest} days</span>
        </div>

        <div className="dash__stat">
          <span className="dash__label">Stars</span>
          <span className="dash__value">{stars}</span>
          <span className="dash__sub">of {maxStars}</span>
        </div>

        <div className="dash__stat">
          <span className="dash__label">This week</span>
          <span className="dash__value">
            {thisWeek}/{progress.weeklyGoal}
          </span>
          <div className="dash__goal-track">
            <div className="dash__goal-fill" style={{ width: `${goalFraction * 100}%` }} />
          </div>
        </div>
      </section>

      {next && (
        <section className="dash__section" aria-label="Next drill">
          <h2 className="dash__section-title">
            {progress.streak.current > 0 ? 'Continue where you left off' : 'Start here'}
          </h2>
          <div className="dash__next">
            <div>
              <div className="dash__next-title">{next.title}</div>
              <div className="dash__next-meta">
                Target {next.targetBpm} BPM
                {next.strictHands ? ' · strict hands' : ''}
                {next.notes ? ` · ${next.notes}` : ''}
              </div>
            </div>
            <span style={{ flex: 1 }} />
            <Link to={`/session/${next.id}`}>
              <Button variant="primary">Play drill</Button>
            </Link>
            <Link to="/library">
              <Button>Browse library</Button>
            </Link>
          </div>
        </section>
      )}

      <section className="dash__section" aria-label="Practice calendar">
        <h2 className="dash__section-title">Practice calendar</h2>
        <ProgressHeatmap progress={progress} />
      </section>

      <section className="dash__section" aria-label="Badges">
        <h2 className="dash__section-title">
          Badges — {earned.size} of {BADGES.length}
        </h2>
        <div className="dash__badges">
          {BADGES.map((badge) => (
            <span
              key={badge.id}
              className={`dash__badge${earned.has(badge.id) ? '' : ' dash__badge--locked'}`}
              title={badge.description}
            >
              <span className="dash__badge-icon" aria-hidden="true">
                {badge.icon}
              </span>
              {badge.title}
            </span>
          ))}
        </div>
      </section>
    </div>
  )
}
