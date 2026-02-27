import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const denseMode = 'ultra'

const cardVariants = cva('rounded-[var(--ui-radius-lg)] border', {
  variants: {
    variant: {
      default: 'border-slate-200 bg-white',
      subtle: 'border-slate-200 bg-slate-50',
      outlined: 'border-slate-300 bg-white',
    },
    density: {
      ultra: 'p-[var(--ui-pad-3)]',
    },
  },
  defaultVariants: {
    variant: 'default',
    density: denseMode,
  },
})

const buttonVariants = cva(
  'inline-flex h-[var(--ui-control-h)] items-center justify-center rounded-[var(--ui-radius-md)] border px-3 text-[var(--ui-font-xs)] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-70',
  {
    variants: {
      variant: {
        primary:
          'border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] text-white hover:bg-blue-700',
        secondary: 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
        ghost: 'border-transparent bg-transparent text-slate-600 hover:bg-slate-100',
        danger: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100',
      },
      density: {
        ultra: '',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      density: denseMode,
    },
  }
)

const fieldVariants = cva(
  'w-full rounded-[var(--ui-radius-md)] border border-slate-300 bg-white px-3 text-[var(--ui-font-sm)] text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300',
  {
    variants: {
      variant: {
        input: 'h-[var(--ui-control-h)]',
        select: 'h-[var(--ui-control-h)] pr-8',
      },
      density: {
        ultra: '',
      },
    },
    defaultVariants: {
      variant: 'input',
      density: denseMode,
    },
  }
)

const chipVariants = cva(
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
  {
    variants: {
      variant: {
        neutral: 'border-slate-200 bg-slate-100 text-slate-700',
        active: 'border-[rgb(var(--speedgoat-blue))]/20 bg-[rgb(var(--speedgoat-blue))]/10 text-[rgb(var(--speedgoat-blue))]',
        warning: 'border-amber-200 bg-amber-50 text-amber-800',
      },
      density: {
        ultra: '',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      density: denseMode,
    },
  }
)

const sectionLabelVariants = cva('text-[11px] font-semibold uppercase tracking-wide text-slate-500', {
  variants: {
    density: {
      ultra: '',
    },
  },
  defaultVariants: {
    density: denseMode,
  },
})

export type CompactCardVariant = VariantProps<typeof cardVariants>['variant']
export type CompactButtonVariant = VariantProps<typeof buttonVariants>['variant']
export type CompactFieldVariant = VariantProps<typeof fieldVariants>['variant']
export type CompactChipVariant = VariantProps<typeof chipVariants>['variant']

type CompactCardProps = {
  className?: string
  children: ReactNode
  variant?: CompactCardVariant
}

export function CompactCard({ className, children, variant }: CompactCardProps) {
  return <div className={cn(cardVariants({ variant }), className)}>{children}</div>
}

type CompactButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: CompactButtonVariant
}

export function CompactButton({ className, variant, ...props }: CompactButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />
}

type BaseCompactFieldProps = {
  className?: string
}

type CompactInputProps = BaseCompactFieldProps &
  InputHTMLAttributes<HTMLInputElement> & {
    as?: 'input'
  }

type CompactSelectProps = BaseCompactFieldProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    as: 'select'
    children: ReactNode
  }

export function CompactField(props: CompactInputProps | CompactSelectProps) {
  if (props.as === 'select') {
    const { className, as, children, ...rest } = props
    return (
      <select className={cn(fieldVariants({ variant: 'select' }), className)} {...rest}>
        {children}
      </select>
    )
  }

  const { className, as, ...rest } = props
  return <input className={cn(fieldVariants({ variant: 'input' }), className)} {...rest} />
}

type CompactChipProps = {
  className?: string
  children: ReactNode
  variant?: CompactChipVariant
  title?: string
}

export function CompactChip({ className, children, variant, title }: CompactChipProps) {
  return (
    <span className={cn(chipVariants({ variant }), className)} title={title}>
      {children}
    </span>
  )
}

type CompactSectionLabelProps = {
  className?: string
  children: ReactNode
}

export function CompactSectionLabel({ className, children }: CompactSectionLabelProps) {
  return <p className={cn(sectionLabelVariants(), className)}>{children}</p>
}

type CompactIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: CompactButtonVariant
}

export function CompactIconButton({ className, variant = 'ghost', ...props }: CompactIconButtonProps) {
  return <CompactButton variant={variant} className={cn('h-7 w-7 px-0 text-xs', className)} {...props} />
}

type CompactAddLinkProps = ButtonHTMLAttributes<HTMLButtonElement>

export function CompactAddLink({ className, ...props }: CompactAddLinkProps) {
  return (
    <button
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-[var(--ui-radius-sm)] px-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900',
        className
      )}
      {...props}
    />
  )
}

type CompactStatBadgeProps = {
  className?: string
  children: ReactNode
}

export function CompactStatBadge({ className, children }: CompactStatBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700',
        className
      )}
    >
      {children}
    </span>
  )
}

type CompactInspectorBlockProps = {
  className?: string
  children: ReactNode
}

export function CompactInspectorBlock({ className, children }: CompactInspectorBlockProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--ui-radius-md)] border border-slate-200 bg-slate-50 p-[var(--ui-pad-2)]',
        className
      )}
    >
      {children}
    </div>
  )
}
