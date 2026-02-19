import type { EditRowData, SubCategory, FieldKey, ConditionalOptions } from './types'

interface EditRowCardProps {
  sub: SubCategory
  data: EditRowData
  onChange: (data: EditRowData) => void
  onSave: () => void
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

export default function EditRowCard({
  sub,
  data,
  onChange,
  onSave,
  onCancel,
}: EditRowCardProps) {
  return (
    <div className="rounded-xl border-2 border-[rgb(var(--speedgoat-blue))]/30 bg-gradient-to-br from-blue-50/90 to-white p-4 shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <label className="text-sm font-bold uppercase tracking-wide text-slate-700">Edit Configuration</label>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Channels:</label>
          <select
            value={data.quantity}
            onChange={(e) => onChange({ ...data, quantity: Number(e.target.value) })}
            className="w-20 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition outline-none hover:border-slate-400 focus:border-[rgb(var(--speedgoat-blue))] focus:ring-2 focus:ring-[rgb(var(--speedgoat-blue))]/20"
            aria-label="Edit channels"
          >
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
          const fieldOptions = getFieldOptions(field, data.specs)
          return (
            <div key={field.key}>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-700">
                {field.label}
              </label>
              <select
                value={data.specs[field.key]}
                onChange={(e) =>
                  onChange({
                    ...data,
                    specs: { ...data.specs, [field.key]: e.target.value },
                  })
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition outline-none hover:border-slate-400 focus:border-[rgb(var(--speedgoat-blue))] focus:ring-2 focus:ring-[rgb(var(--speedgoat-blue))]/20"
                aria-label={`Edit ${field.label}`}
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
          onClick={onSave}
          className="flex-1 rounded-lg border border-[rgb(var(--speedgoat-blue))] bg-[rgb(var(--speedgoat-blue))] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md"
        >
          ✓ Save Changes
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:border-slate-400"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
