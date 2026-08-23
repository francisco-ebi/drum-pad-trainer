import { ErrorBoundary } from './error-boundary'
import { AppRouter } from './router'
import './styles/global.css'

/** App entry: routing, global styles and the top-level error boundary. */
export function App() {
  return (
    <ErrorBoundary>
      <AppRouter />
    </ErrorBoundary>
  )
}
