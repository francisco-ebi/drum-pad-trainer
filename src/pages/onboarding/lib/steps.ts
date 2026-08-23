export type OnboardingStepId = 'connect' | 'mapping' | 'calibration' | 'first-drill'

export interface OnboardingStep {
  id: OnboardingStepId
  title: string
  /** One line telling the user what this step is for. */
  blurb: string
  /** Steps the user may pass without doing anything. */
  skippable: boolean
}

const ALL: Record<OnboardingStepId, OnboardingStep> = {
  connect: {
    id: 'connect',
    title: 'Connect your controller',
    blurb: 'Plug in a 4×4 MIDI pad controller, or play on the keyboard instead.',
    skippable: true,
  },
  mapping: {
    id: 'mapping',
    title: 'Map the pads',
    blurb: 'Tell the app which note each pad sends — a preset, or one pad at a time.',
    skippable: true,
  },
  calibration: {
    id: 'calibration',
    title: 'Measure your latency',
    blurb: 'Play along with sixteen clicks so hits are judged against what you heard.',
    skippable: true,
  },
  'first-drill': {
    id: 'first-drill',
    title: 'Play your first drill',
    blurb: 'Four bars of quarter-note kick. Stars are earned at the target tempo.',
    skippable: false,
  },
}

export interface StepContext {
  /** Does this browser expose Web MIDI at all (§3)? */
  midiSupported: boolean
  /** Is the user going to play on the computer keyboard? */
  keyboardOnly: boolean
}

/**
 * The steps this user actually needs (§12).
 *
 * Mapping is dropped for a keyboard player: the keyboard yields pads directly,
 * so there is no note map to fill in, and a step that can only be skipped is
 * worse than no step at all.
 */
export function onboardingSteps({ midiSupported, keyboardOnly }: StepContext): OnboardingStep[] {
  const ids: OnboardingStepId[] = ['connect']
  if (midiSupported && !keyboardOnly) ids.push('mapping')
  ids.push('calibration', 'first-drill')
  return ids.map((id) => ALL[id])
}

/** Where the flow hands over: the first drill of the first track (§11.1). */
export const FIRST_DRILL_ID = 'foundations-quarter-kick'
