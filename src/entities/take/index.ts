export { TakeJudge } from './lib/judge'
export { PracticeSession, STRICT_MISS_LIMIT } from './model/session'
export type {
  PracticeSessionCallbacks,
  PracticeSessionConfig,
  PracticeUpdate,
  TakeAudio,
  TakeInterruption,
  TakeRuntime,
} from './model/session'
export {
  buildTakeTimeline,
  expectedHitsForStep,
  upcomingWithin,
} from './lib/expected-timeline'
export type { ExpectedContext, TimelineOptions } from './lib/expected-timeline'
export {
  buildLaneRoles,
  hasNoUserLanes,
  isUserLane,
  LANE_PRESETS,
} from './lib/lane-roles'
export type { LanePreset, LaneRole, LaneRoles } from './lib/lane-roles'
export { judgeTake } from './lib/judge-take'
export {
  buildHistogram,
  findWeakSpot,
  summarize,
  summarizeTiming,
  HISTOGRAM_BUCKET_MS,
  HISTOGRAM_RANGE_MS,
  TIMING_VERDICT_THRESHOLD_MS,
} from './lib/analyze'
export type { OffsetBucket, TakeResult, TimingSummary, WeakSpot } from './lib/analyze'
export {
  accuracyOf,
  comboMultiplier,
  continuesCombo,
  gradeLetter,
  loopAccuracy,
  COMBO_STEPS,
  GRADE_THRESHOLDS,
  POINTS,
} from './lib/score'
export { isOutsideGood, windowsFor } from './lib/windows'
export type { TimingWindows } from './lib/windows'
export { DEFAULT_JUDGE_CONFIG } from './model/types'
export type {
  Direction,
  ExpectedHit,
  Grade,
  JudgeConfig,
  Judgment,
  TakeStats,
  UserHit,
} from './model/types'
