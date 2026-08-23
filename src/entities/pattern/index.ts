export type { Hand, Hit, Pattern, DrillConfig, Voice } from './model/types'
export { VOICES, isVoice } from './model/types'

export {
  isValidPattern,
  parsePattern,
  patternStepsPerBar,
  PatternValidationError,
  validatePattern,
} from './lib/validate'
export type { ValidationIssue } from './lib/validate'

export {
  hitHand,
  hitKey,
  hitsAtStep,
  indexPattern,
  isDownbeat,
  stepCount,
  toAbsoluteStep,
} from './lib/query'
export type { PatternIndex } from './lib/query'

export { VOICE_META, voiceColor, DYNAMICS } from './config/voices'
export type { VoiceMeta } from './config/voices'

export {
  DEFAULT_PATTERN_ID,
  getPattern,
  SEED_PATTERNS,
  SEED_PATTERNS_BY_ID,
} from './seeds'
