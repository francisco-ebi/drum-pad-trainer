import { isVoice, type Hit, type Pattern } from '../model/types'

export interface ValidationIssue {
  path: string
  message: string
}

export class PatternValidationError extends Error {
  constructor(readonly issues: ValidationIssue[]) {
    super(`Invalid pattern:\n${issues.map((i) => `  ${i.path}: ${i.message}`).join('\n')}`)
    this.name = 'PatternValidationError'
  }
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isIntIn(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
}

/** Steps per bar for a pattern's metre (§7.3 uses the same rule). */
export function patternStepsPerBar(pattern: Pick<Pattern, 'timeSig' | 'subdivision'>): number {
  return pattern.timeSig[0] * (pattern.subdivision / 4)
}

function validateHit(raw: unknown, path: string, perBar: number, bars: number, issues: ValidationIssue[]): void {
  if (!isRecord(raw)) {
    issues.push({ path, message: 'must be an object' })
    return
  }
  if (!isIntIn(raw.bar, 0, bars - 1)) {
    issues.push({ path: `${path}.bar`, message: `must be an integer in 0..${bars - 1}` })
  }
  if (!isIntIn(raw.step, 0, perBar - 1)) {
    issues.push({ path: `${path}.step`, message: `must be an integer in 0..${perBar - 1}` })
  }
  if (!isVoice(raw.voice)) {
    issues.push({ path: `${path}.voice`, message: `unknown voice ${JSON.stringify(raw.voice)}` })
  }
  if (raw.hand !== undefined && raw.hand !== 'R' && raw.hand !== 'L') {
    issues.push({ path: `${path}.hand`, message: 'must be "R" or "L"' })
  }
  for (const flag of ['accent', 'ghost'] as const) {
    if (raw[flag] !== undefined && typeof raw[flag] !== 'boolean') {
      issues.push({ path: `${path}.${flag}`, message: 'must be a boolean' })
    }
  }
  if (raw.accent === true && raw.ghost === true) {
    issues.push({ path, message: 'cannot be both accent and ghost' })
  }
}

/** Validate unknown JSON against the §5 schema. Returns every problem found. */
export function validatePattern(raw: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!isRecord(raw)) return [{ path: '$', message: 'must be an object' }]

  if (typeof raw.id !== 'string' || !SLUG.test(raw.id)) {
    issues.push({ path: 'id', message: 'must be a kebab-case slug' })
  }
  if (typeof raw.title !== 'string' || raw.title.trim() === '') {
    issues.push({ path: 'title', message: 'must be a non-empty string' })
  }
  if (!isIntIn(raw.level, 1, 99)) {
    issues.push({ path: 'level', message: 'must be an integer >= 1' })
  }

  const timeSig = raw.timeSig
  const validTimeSig =
    Array.isArray(timeSig) && timeSig.length === 2 && isIntIn(timeSig[0], 1, 32) && isIntIn(timeSig[1], 1, 32)
  if (!validTimeSig) {
    issues.push({ path: 'timeSig', message: 'must be [beats, beatUnit]' })
  }
  if (raw.subdivision !== 8 && raw.subdivision !== 16) {
    issues.push({ path: 'subdivision', message: 'must be 8 or 16' })
  }
  if (!isIntIn(raw.bars, 1, 64)) {
    issues.push({ path: 'bars', message: 'must be an integer in 1..64' })
  }

  const range = raw.bpmRange
  const validRange =
    Array.isArray(range) && range.length === 2 && isIntIn(range[0], 20, 400) && isIntIn(range[1], 20, 400)
  if (!validRange) {
    issues.push({ path: 'bpmRange', message: 'must be [min, max] BPM' })
  } else if ((range[0] as number) >= (range[1] as number)) {
    issues.push({ path: 'bpmRange', message: 'min must be below max' })
  }
  if (!isIntIn(raw.bpmDefault, 20, 400)) {
    issues.push({ path: 'bpmDefault', message: 'must be an integer BPM' })
  } else if (validRange && ((raw.bpmDefault as number) < (range[0] as number) || (raw.bpmDefault as number) > (range[1] as number))) {
    issues.push({ path: 'bpmDefault', message: 'must sit inside bpmRange' })
  }

  // Everything below needs a usable metre.
  if (issues.some((i) => i.path === 'timeSig' || i.path === 'subdivision' || i.path === 'bars')) {
    return issues
  }
  const perBar = patternStepsPerBar(raw as unknown as Pattern)
  const bars = raw.bars as number

  if (!Array.isArray(raw.countLabels) || raw.countLabels.some((l) => typeof l !== 'string')) {
    issues.push({ path: 'countLabels', message: 'must be an array of strings' })
  } else if (raw.countLabels.length !== perBar) {
    issues.push({
      path: 'countLabels',
      message: `must have one label per step (${perBar}), got ${raw.countLabels.length}`,
    })
  }

  if (!Array.isArray(raw.lanes) || raw.lanes.length === 0 || !raw.lanes.every(isVoice)) {
    issues.push({ path: 'lanes', message: 'must be a non-empty array of voices' })
  } else if (new Set(raw.lanes).size !== raw.lanes.length) {
    issues.push({ path: 'lanes', message: 'must not repeat a voice' })
  }

  if (!Array.isArray(raw.hits)) {
    issues.push({ path: 'hits', message: 'must be an array' })
  } else {
    raw.hits.forEach((hit, i) => validateHit(hit, `hits[${i}]`, perBar, bars, issues))

    const lanes = Array.isArray(raw.lanes) ? raw.lanes : []
    const seen = new Set<string>()
    for (const [i, hit] of raw.hits.entries()) {
      if (!isRecord(hit)) continue
      const key = `${String(hit.bar)}:${String(hit.step)}:${String(hit.voice)}:${String(hit.hand ?? 'R')}`
      if (seen.has(key)) {
        issues.push({ path: `hits[${i}]`, message: 'duplicate hit' })
      }
      seen.add(key)
      if (isVoice(hit.voice) && !lanes.includes(hit.voice)) {
        issues.push({ path: `hits[${i}].voice`, message: `voice "${hit.voice}" is not in lanes` })
      }
    }
  }

  if (raw.drill !== undefined) {
    const drill = raw.drill
    if (!isRecord(drill)) {
      issues.push({ path: 'drill', message: 'must be an object' })
    } else {
      if (!isIntIn(drill.targetBpm, 20, 400)) {
        issues.push({ path: 'drill.targetBpm', message: 'must be an integer BPM' })
      }
      const stars = drill.starAccuracy
      if (!Array.isArray(stars) || stars.length !== 3 || !stars.every((s) => isIntIn(s, 0, 100))) {
        issues.push({ path: 'drill.starAccuracy', message: 'must be three percentages' })
      } else if (!((stars[0] as number) < (stars[1] as number) && (stars[1] as number) < (stars[2] as number))) {
        issues.push({ path: 'drill.starAccuracy', message: 'thresholds must increase' })
      }
      if (drill.strictHands !== undefined && typeof drill.strictHands !== 'boolean') {
        issues.push({ path: 'drill.strictHands', message: 'must be a boolean' })
      }
      if (drill.notes !== undefined && typeof drill.notes !== 'string') {
        issues.push({ path: 'drill.notes', message: 'must be a string' })
      }
    }
  }

  return issues
}

export function isValidPattern(raw: unknown): raw is Pattern {
  return validatePattern(raw).length === 0
}

/** Validate and narrow, throwing a readable error on failure. */
export function parsePattern(raw: unknown): Pattern {
  const issues = validatePattern(raw)
  if (issues.length > 0) throw new PatternValidationError(issues)
  return raw as Pattern
}

export type { Hit }
