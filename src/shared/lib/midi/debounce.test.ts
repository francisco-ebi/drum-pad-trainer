import { describe, expect, it } from 'vitest'
import { createNoteDebounce } from './debounce'

describe('note debounce (§8.1)', () => {
  it('swallows a same-note retrigger inside the window', () => {
    const debounce = createNoteDebounce(30)
    expect(debounce.accept(38, 1000)).toBe(true)
    expect(debounce.accept(38, 1010)).toBe(false)
    expect(debounce.accept(38, 1029)).toBe(false)
  })

  it('lets the note through once the window has passed', () => {
    const debounce = createNoteDebounce(30)
    expect(debounce.accept(38, 1000)).toBe(true)
    expect(debounce.accept(38, 1030)).toBe(true)
    expect(debounce.accept(38, 1061)).toBe(true)
  })

  it('never blocks a different note — a flam is real playing', () => {
    const debounce = createNoteDebounce(30)
    expect(debounce.accept(38, 1000)).toBe(true)
    expect(debounce.accept(36, 1005)).toBe(true)
    expect(debounce.accept(42, 1008)).toBe(true)
  })

  it('tracks notes per device', () => {
    const debounce = createNoteDebounce(30)
    expect(debounce.accept(38, 1000, 'pad-a')).toBe(true)
    expect(debounce.accept(38, 1005, 'pad-b')).toBe(true)
    expect(debounce.accept(38, 1005, 'pad-a')).toBe(false)
  })

  it('forgets everything on reset', () => {
    const debounce = createNoteDebounce(30)
    expect(debounce.accept(38, 1000)).toBe(true)
    debounce.reset()
    expect(debounce.accept(38, 1001)).toBe(true)
  })
})
