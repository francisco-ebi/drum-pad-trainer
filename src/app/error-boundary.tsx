import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | undefined
}

/** Last line of defence: a malformed pattern or a dead AudioContext should
 *  show a readable message, not a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: undefined }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled error', error, info.componentStack)
  }

  override render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="app__error" role="alert">
        <h2>Something broke</h2>
        <pre>{error.message}</pre>
      </div>
    )
  }
}
