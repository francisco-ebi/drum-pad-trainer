import type { ExpectedHit, JudgeConfig, UserHit } from '../model/types'
import { summarize, type TakeResult } from './analyze'
import { TakeJudge } from './judge'

/**
 * Score a complete take in one call — the same judge the live HUD drives, run
 * to completion. Used by the scripted-take tests and the virtual-MIDI tool.
 */
export function judgeTake(
  expected: readonly ExpectedHit[],
  userHits: readonly UserHit[],
  config: Partial<JudgeConfig> & Pick<JudgeConfig, 'secondsPerStep'>,
): TakeResult {
  const judge = new TakeJudge(config)
  judge.expectAll(expected)
  for (const hit of [...userHits].sort((a, b) => a.time - b.time)) {
    judge.hit(hit)
  }
  judge.settle(Infinity)
  return summarize(judge)
}
