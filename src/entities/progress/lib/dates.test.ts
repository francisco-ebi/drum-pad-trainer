import { describe, expect, it } from 'vitest'
import { currentWeek, dayKey, daysBetween, parseDayKey, recentDays } from './dates'

describe('calendar helpers (§11.2)', () => {
  it('formats a local day key', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
    expect(dayKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31')
  })

  it('uses the local day, not UTC — a streak is about the user’s day', () => {
    // Late evening local time can be the next day in UTC; the key must not shift.
    const lateEvening = new Date(2026, 5, 10, 23, 59)
    expect(dayKey(lateEvening)).toBe('2026-06-10')
  })

  it('round-trips a day key', () => {
    const key = '2026-03-14'
    const parsed = parseDayKey(key)
    expect(parsed).toBeDefined()
    if (parsed) expect(dayKey(parsed)).toBe(key)
    expect(parseDayKey('nonsense')).toBeUndefined()
  })

  it('counts days between keys, across months and years', () => {
    expect(daysBetween('2026-08-20', '2026-08-21')).toBe(1)
    expect(daysBetween('2026-08-31', '2026-09-01')).toBe(1)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2026-08-20', '2026-08-20')).toBe(0)
    expect(daysBetween('2026-08-25', '2026-08-20')).toBe(-5)
    expect(daysBetween('bad', '2026-08-20')).toBeUndefined()
  })

  it('handles a daylight-saving change without dropping a day', () => {
    // Late March in most of Europe; the clocks go forward.
    expect(daysBetween('2026-03-28', '2026-03-29')).toBe(1)
    expect(daysBetween('2026-03-29', '2026-03-30')).toBe(1)
  })

  it('lists the last N days ending today, oldest first', () => {
    const days = recentDays(new Date(2026, 7, 20), 5)
    expect(days).toEqual(['2026-08-16', '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20'])
  })

  it('lists the current week from Monday', () => {
    // 2026-08-20 is a Thursday.
    const week = currentWeek(new Date(2026, 7, 20))
    expect(week).toHaveLength(7)
    expect(week[0]).toBe('2026-08-17')
    expect(week[6]).toBe('2026-08-23')
    expect(week).toContain('2026-08-20')
  })

  it('treats Sunday as the end of the week, not the start', () => {
    // 2026-08-23 is a Sunday.
    const week = currentWeek(new Date(2026, 7, 23))
    expect(week[0]).toBe('2026-08-17')
    expect(week[6]).toBe('2026-08-23')
  })
})
