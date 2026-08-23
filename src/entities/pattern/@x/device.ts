/** Public surface of `entities/pattern` for `entities/device` (FSD @x
 *  cross-import notation, §13.2). The device slice needs to talk about voices
 *  and hands to lay out pads; nothing else crosses. */
export type { Hand, Voice } from '../model/types'
export { VOICE_META } from '../config/voices'
export { VOICES } from '../model/types'
