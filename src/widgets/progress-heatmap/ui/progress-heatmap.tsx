import { dayKey, recentDays, type ProgressState } from '@/entities/progress'
import './progress-heatmap.css'

export interface ProgressHeatmapProps {
  progress: ProgressState
  /** How many days back to show; rounded up to whole weeks. */
  days?: number
  /** Injected so the calendar is testable without mocking the clock. */
  today?: Date
}

/** Four shades, so a heavy day reads differently from a single take. */
function level(takes: number): string {
  if (takes <= 0) return ''
  if (takes === 1) return ' heatmap__day--l1'
  if (takes === 2) return ' heatmap__day--l2'
  if (takes <= 4) return ' heatmap__day--l3'
  return ' heatmap__day--l4'
}

/**
 * The practice calendar (§11.2). Columns are weeks and rows are weekdays, so
 * a habit shows up as a solid block rather than a long thin line.
 */
export function ProgressHeatmap({ progress, days = 119, today = new Date() }: ProgressHeatmapProps) {
  // Start on a Monday so each column is a whole week.
  const weekdayOffset = (today.getDay() + 6) % 7
  const span = days + (6 - weekdayOffset)
  const all = recentDays(today, span)
  const todayKey = dayKey(today)

  const totalTakes = all.reduce((sum, day) => sum + (progress.history[day] ?? 0), 0)
  const activeDays = all.filter((day) => (progress.history[day] ?? 0) > 0).length

  return (
    <div className="heatmap">
      <div className="heatmap__grid" role="img" aria-label={`Practice calendar: ${totalTakes} takes over ${activeDays} days`}>
        {all.map((day) => {
          const takes = progress.history[day] ?? 0
          return (
            <div
              key={day}
              className={`heatmap__day${level(takes)}${day === todayKey ? ' heatmap__day--today' : ''}`}
              title={`${day}: ${takes} ${takes === 1 ? 'take' : 'takes'}`}
            />
          )
        })}
      </div>
      <div className="heatmap__legend">
        <span>
          {activeDays} active {activeDays === 1 ? 'day' : 'days'}
        </span>
        <span className="heatmap__scale" aria-hidden="true">
          <span className="heatmap__day" />
          <span className="heatmap__day heatmap__day--l1" />
          <span className="heatmap__day heatmap__day--l2" />
          <span className="heatmap__day heatmap__day--l3" />
          <span className="heatmap__day heatmap__day--l4" />
        </span>
        <span>more</span>
      </div>
    </div>
  )
}
