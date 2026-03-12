'use client'

import { CompactButton, CompactChip } from '@/components/ui/compact'
import { cn } from '@/lib/cn'

type FloatingBottomBarProps = {
  totalSignals: number
  rowCount: number
  machineName: string
  categoryTotals: Record<string, number>
  canGenerate: boolean
  isGenerating: boolean
  isSuccess: boolean
  isStale: boolean
  onGenerate: () => void
  generateButtonLabel: string
  className?: string
}

export default function FloatingBottomBar({
  totalSignals,
  rowCount,
  machineName,
  categoryTotals,
  canGenerate,
  isGenerating,
  isSuccess,
  isStale,
  onGenerate,
  generateButtonLabel,
  className,
}: FloatingBottomBarProps) {
  const activeCategories = Object.entries(categoryTotals).filter(([, total]) => total > 0)
  const groupLabel = rowCount === 1 ? 'group' : 'groups'

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] backdrop-blur',
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1520px] items-center justify-between gap-3 px-4 py-2 md:px-8">
        {/* Left: summary chips */}
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          <span className="shrink-0 text-xs font-semibold text-slate-700">
            {machineName}
          </span>
          <span className="shrink-0 text-slate-300">·</span>

          {totalSignals > 0 ? (
            <>
              <span className="shrink-0 text-xs tabular-nums text-slate-600">
                {totalSignals} ch · {rowCount} {groupLabel}
              </span>
              {activeCategories.length > 0 && (
                <>
                  <span className="shrink-0 text-slate-300">·</span>
                  <div className="flex items-center gap-1 overflow-x-auto">
                    {activeCategories.map(([label, total]) => (
                      <CompactChip
                        key={label}
                        variant="neutral"
                        className="shrink-0 whitespace-nowrap px-1.5 py-0 text-[10px]"
                      >
                        {label} {total}
                      </CompactChip>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <span className="shrink-0 text-xs text-slate-400">No I/O configured yet</span>
          )}
        </div>

        {/* Right: generate button */}
        <CompactButton
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate || isGenerating}
          variant={canGenerate && !isGenerating ? 'primary' : 'secondary'}
          className={cn(
            'shrink-0 transition-colors duration-500',
            (!canGenerate || isGenerating) && 'text-slate-400',
            isSuccess && !isStale && '!border-green-600 !bg-green-600 !text-white hover:!bg-green-700',
            isStale && '!border-amber-500 !bg-amber-500 !text-white hover:!bg-amber-600',
          )}
        >
          {isGenerating && (
            <svg className="mr-1.5 h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
              <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
          {generateButtonLabel}
        </CompactButton>
      </div>
    </div>
  )
}
