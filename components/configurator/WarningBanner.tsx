interface WarningBannerProps {
  message: string
  onDismiss: () => void
}

export default function WarningBanner({ message, onDismiss }: WarningBannerProps) {
  return (
    <div className="mx-5 mt-5 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm text-orange-800">
      <div className="flex items-center justify-between">
        <span>{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-orange-600 hover:text-orange-800"
          aria-label="Dismiss warning"
        >
          ×
        </button>
      </div>
    </div>
  )
}
