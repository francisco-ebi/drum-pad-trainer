import type { ReactNode } from 'react'
import './ui.css'

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="ui-visually-hidden">{children}</span>
}
