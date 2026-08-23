/** Local calendar day as YYYY-MM-DD. Local, not UTC: a practice streak is
 *  about the user's day, not Greenwich's. */
export function dayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDayKey(key: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!match) return undefined
  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

/** Whole days between two day keys, or undefined if either is malformed. */
export function daysBetween(fromKey: string, toKey: string): number | undefined {
  const from = parseDayKey(fromKey)
  const to = parseDayKey(toKey)
  if (!from || !to) return undefined
  return Math.round((to.getTime() - from.getTime()) / 86_400_000)
}

/** The last `count` days ending today, oldest first — the heatmap's axis. */
export function recentDays(today: Date, count: number): string[] {
  const days: string[] = []
  for (let offset = count - 1; offset >= 0; offset--) {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    days.push(dayKey(day))
  }
  return days
}

/** Day keys in the current week, Monday first. */
export function currentWeek(today: Date): string[] {
  const weekday = (today.getDay() + 6) % 7 // Monday = 0
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - weekday)
  return Array.from({ length: 7 }, (_, offset) =>
    dayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + offset)),
  )
}
