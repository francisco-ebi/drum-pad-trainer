import { SessionPage } from '@/pages/session'
import { ErrorBoundary } from './error-boundary'
import './styles/global.css'

/**
 * App shell. Watch and Practice both live on the Session screen; the
 * Dashboard / Library / Results routes (§12) arrive with M3, at which point
 * this gains a router.
 */
export function App() {
  return (
    <ErrorBoundary>
      <div className="app">
        <header className="app__bar">
          <span className="app__brand">Drum Pad Trainer</span>
          <span className="app__tag">Watch + Practice · M2</span>
        </header>
        <main style={{ flex: 1 }}>
          <SessionPage />
        </main>
      </div>
    </ErrorBoundary>
  )
}
