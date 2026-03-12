import type { RowData, SubCategory } from './types'

interface RowCardProps {
  row: RowData
  sub: SubCategory
  onEdit: (row: RowData) => void
  onRemove: (rowId: string) => void
  onChangeQuantity: (rowId: string, quantity: number) => void
}

export default function RowCard({ row, sub, onEdit, onRemove, onChangeQuantity }: RowCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Channels:</label>
            <select
              value={row.quantity}
              onChange={(e) => onChangeQuantity(row.id, Number(e.target.value))}
              className="w-16 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 outline-none ring-[rgb(var(--speedgoat-blue))] focus:ring-1"
              aria-label="Channels"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={4}>4</option>
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
              <option value={64}>64</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            {sub.fields.map((field) => (
              <div key={field.key} className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {field.label}
                </span>
                <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                  {row.specs[field.key]}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onEdit(row)}
            className="text-xs text-[rgb(var(--speedgoat-blue))] hover:underline"
            aria-label="Edit configuration"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onRemove(row.id)}
            className="text-slate-400 hover:text-red-600"
            aria-label="Remove configuration"
            title="Remove"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
