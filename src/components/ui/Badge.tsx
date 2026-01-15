import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils/cn'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-bg-hover text-gray-300 border border-border',
      success: 'bg-success/20 text-success border border-success/30',
      warning: 'bg-accent/20 text-accent border border-accent/30',
      danger: 'bg-error/20 text-error border border-error/30',
      info: 'bg-info/20 text-info border border-info/30',
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)

Badge.displayName = 'Badge'
