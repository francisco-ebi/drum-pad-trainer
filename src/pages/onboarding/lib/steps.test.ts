import { describe, expect, it } from 'vitest'
import { onboardingSteps } from './steps'

describe('onboarding steps (§12)', () => {
  it('walks connect → mapping → calibration → first drill with a controller', () => {
    const steps = onboardingSteps({ midiSupported: true, keyboardOnly: false })
    expect(steps.map((step) => step.id)).toEqual(['connect', 'mapping', 'calibration', 'first-drill'])
  })

  it('drops the mapping step for a keyboard player — there is no map to fill', () => {
    const steps = onboardingSteps({ midiSupported: true, keyboardOnly: true })
    expect(steps.map((step) => step.id)).toEqual(['connect', 'calibration', 'first-drill'])
  })

  it('drops it too where the browser has no Web MIDI at all', () => {
    const steps = onboardingSteps({ midiSupported: false, keyboardOnly: false })
    expect(steps.map((step) => step.id)).toEqual(['connect', 'calibration', 'first-drill'])
  })

  it('always ends on the first drill, and never lets it be skipped', () => {
    for (const midiSupported of [true, false]) {
      for (const keyboardOnly of [true, false]) {
        const steps = onboardingSteps({ midiSupported, keyboardOnly })
        expect(steps.at(-1)?.id).toBe('first-drill')
        expect(steps.at(-1)?.skippable).toBe(false)
      }
    }
  })

  it('gives every step something to read', () => {
    for (const step of onboardingSteps({ midiSupported: true, keyboardOnly: false })) {
      expect(step.title.length).toBeGreaterThan(0)
      expect(step.blurb.length).toBeGreaterThan(0)
    }
  })
})
