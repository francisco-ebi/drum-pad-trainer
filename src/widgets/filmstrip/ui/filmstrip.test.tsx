import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { indexPattern, SEED_PATTERNS, type Pattern } from '@/entities/pattern'
import { PAD_COLS } from '@/shared/config'
import { Filmstrip } from './filmstrip'
import { spokenCount } from './spoken-count'

/**
 * Golden-file guard for §6.2: with no playback running, the filmstrip must
 * reproduce the reference material exactly. The DOM is reduced to an ASCII
 * 4x4 per step (● lead hand, ◆ alternate hand) so the snapshot is readable
 * and a wrong pad is obvious in review.
 */
function asciiFilmstrip(pattern: Pattern): string {
  const { container } = render(<Filmstrip index={indexPattern(pattern)} activeStep={-1} />)
  const frames = [...container.querySelectorAll('.strip__frame')]
  return frames
    .map((frame) => {
      const caption = frame.querySelector('.strip__caption')?.textContent ?? ''
      const cells = [...frame.querySelectorAll('.strip__pad')].map((pad) => {
        const mark = pad.querySelector('.strip__mark')
        if (!mark) return '.'
        return mark.classList.contains('strip__mark--alt') ? '◆' : '●'
      })
      const rows: string[] = []
      for (let row = 0; row < cells.length / PAD_COLS; row++) {
        rows.push(cells.slice(row * PAD_COLS, row * PAD_COLS + PAD_COLS).join(''))
      }
      return `${caption}\n${rows.join('\n')}`
    })
    .join('\n\n')
}

describe('filmstrip static render', () => {
  for (const pattern of SEED_PATTERNS) {
    it(`matches the reference frames for ${pattern.title}`, () => {
      expect(asciiFilmstrip(pattern)).toMatchSnapshot()
    })
  }

  it('renders one frame per step, captioned with the spoken count', () => {
    const pattern = SEED_PATTERNS[0]
    expect(pattern).toBeDefined()
    if (!pattern) return
    const index = indexPattern(pattern)
    const { container } = render(<Filmstrip index={index} activeStep={-1} />)
    expect(container.querySelectorAll('.strip__frame')).toHaveLength(index.totalSteps)
    expect(container.querySelector('.strip__caption')?.textContent).toBe('One')
    expect(spokenCount('&')).toBe('&')
  })

  it('marks the active and next frames during playback', () => {
    const pattern = SEED_PATTERNS[0]
    expect(pattern).toBeDefined()
    if (!pattern) return
    const index = indexPattern(pattern)
    const { container } = render(<Filmstrip index={index} activeStep={2} />)
    const frames = [...container.querySelectorAll('.strip__frame')]
    expect(frames[2]?.className).toContain('is-active')
    expect(frames[3]?.className).toContain('is-next')
    expect(frames[0]?.className).toContain('is-past')
    expect(frames[2]).toHaveAttribute('aria-current', 'step')
  })
})
