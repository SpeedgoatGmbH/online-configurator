import type { FieldKey, SubCategory, TempSpecState, ConditionalOptions } from './types'

interface AddConfigFormProps {
  sub: SubCategory
  tempSpec: TempSpecState
  onChangeQuantity: (quantity: number) => void
  onChangeSpec: (fieldKey: FieldKey, value: string) => void
  onAdd: () => void
  onCancel: () => void
}

// Helper function to get options for a field, handling conditional options
function getFieldOptions(
  field: { key: FieldKey; label: string; options: string[] | ConditionalOptions },
  currentSpecs: Record<FieldKey, string>
): string[] {
  if (Array.isArray(field.options)) {
    return field.options
  }
  
  // Handle conditional options
  const dependentValue = currentSpecs[field.options.dependsOn]
  return field.options.conditions[dependentValue] || []
}

export default function AddConfigForm({
  sub,
  tempSpec,
  onChangeQuantity,
  onChangeSpec,
  onAdd,
  onCancel,
}: AddConfigFormProps) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-300 bg-gradient-to-br from-slate-50/50 to-white p-4 shadow-sm hover:border-slate-400 hover:shadow-md transition">
      <div className="mb-3 flex items-center justify-between">
        <label className="text-sm font-bold uppercase tracking-wide text-slate-700">Add Variant</label>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Channels:</label>
          <select
            value={tempSpec.quantity}
            onChange={(e) => onChangeQuantity(Number(e.target.value))}
            className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition outline-none hover:border-slate-400 focus:border-[rgb(var(--speedgoat-blue))] focus:ring-2 focus:ring-[rgb(var(--speedgoat-blue))]/20"
            aria-label={`Channels for ${sub.label}`}
          >
            <option value={0}>0</option>
            <option value={4}>4</option>
            <option value={8}>8</option>
            <option value={16}>16</option>
            <option value={32}>32</option>
            <option value={64}>64</option>
          </select>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {sub.fields.map((field) => {
          const fieldOptions = getFieldOptions(field, tempSpec.specs)
          return (
            <div key={field.key}>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">
                {field.label}
              </label>
              <select
                value={tempSpec.specs[field.key]}
                onChange={(e) => onChangeSpec(field.key, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition outline-none hover:border-slate-400 focus:border-[rgb(var(--speedgoat-blue))] focus:ring-2 focus:ring-[rgb(var(--speedgoat-blue))]/20"
                aria-label={`${field.label} for ${sub.label}`}
              >
                {fieldOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>

      <div className="flex gap-3 border-t border-slate-200/50 pt-3">
        <button
          type="button"
          onClick={onAdd}
          disabled={tempSpec.quantity === 0}
          className="flex-1 rounded-lg border border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
        >
          + Add to List
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:border-slate-400"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
