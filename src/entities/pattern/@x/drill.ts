/** Public surface of `entities/pattern` for `entities/drill` (FSD @x
 *  cross-import notation, §13.2). The curriculum names voices and reads
 *  pattern metadata; it never reaches into rendering or validation. */
export type { Pattern, Voice } from '../model/types'
export { VOICE_META } from '../config/voices'
export { getPattern } from '../seeds'
