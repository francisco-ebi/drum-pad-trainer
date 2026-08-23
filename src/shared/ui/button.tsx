import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './ui.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'ghost'
  icon?: boolean
  children?: ReactNode
}

export function Button({ variant = 'default', icon = false, className, ...props }: ButtonProps) {
  const classes = [
    'ui-button',
    variant !== 'default' ? `ui-button--${variant}` : '',
    icon ? 'ui-button--icon' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
  return <button type="button" className={classes} {...props} />
}
