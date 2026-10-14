/** A small set of light-theme buttons used across the app. */
import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

/** Returns the Tailwind classes for a given button variant. */
function variantClasses(variant: Variant): string {
  switch (variant) {
    case 'primary':
      return 'bg-accent text-white hover:bg-indigo-700'
    case 'secondary':
      return 'bg-white text-ink border border-gray-300 hover:bg-gray-50'
    case 'danger':
      return 'bg-white text-red-600 border border-red-200 hover:bg-red-50'
    case 'ghost':
    default:
      return 'bg-transparent text-subtle hover:bg-gray-100'
  }
}

/** A styled button; forwards all native button props. */
export function Button({ variant = 'secondary', children, className = '', ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses(
        variant
      )} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
