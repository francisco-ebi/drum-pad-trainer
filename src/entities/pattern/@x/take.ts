/** Public surface of `entities/pattern` for `entities/take` (FSD @x
 *  cross-import notation, §13.2). A take is *about* a pattern — it judges what
 *  the pattern asks for — so it reads the model and the derived index, but
 *  never validation, seeds or rendering helpers. */
export type { Hand, Hit, Pattern, Voice } from '../model/types'
export type { PatternIndex } from '../lib/query'
export { hitHand, hitsAtStep } from '../lib/query'
export { DYNAMICS, VOICE_META } from '../config/voices'
