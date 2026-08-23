/** The slice of the Storage API this app needs — narrow enough to fake. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** In-memory storage: the fallback where localStorage is unavailable or
 *  blocked (private mode, embedded frames), and what tests run against. */
export function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

let fallback: KeyValueStorage | undefined

/** localStorage where it works, memory where it does not — writing to a
 *  blocked store throws, and losing preferences must not break the app. */
export function defaultStorage(): KeyValueStorage {
  try {
    const probe = '__dpt_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    fallback ??= memoryStorage()
    return fallback
  }
}
