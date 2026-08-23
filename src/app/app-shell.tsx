import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { levelProgress, useProgress } from '@/entities/progress'

const LINKS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/library', label: 'Library', end: false },
  { to: '/session', label: 'Free play', end: false },
  { to: '/settings', label: 'Settings', end: false },
]

/** Persistent chrome: brand, navigation and the level read-out (§12). */
export function AppShell({ children }: { children: ReactNode }) {
  const xp = useProgress((s) => s.progress.xp)
  const streak = useProgress((s) => s.progress.streak.current)
  const level = levelProgress(xp)

  return (
    <div className="app">
      <header className="app__bar">
        <span className="app__brand">Drum Pad Trainer</span>
        <nav className="app__nav" aria-label="Main">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `app__link${isActive ? ' is-active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <span style={{ flex: 1 }} />
        {streak > 0 && (
          <span className="app__tag" title="Daily practice streak">
            🔥 {streak}
          </span>
        )}
        <span className="app__tag">Lv {level.level}</span>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  )
}
