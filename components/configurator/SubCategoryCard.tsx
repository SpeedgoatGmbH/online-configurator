import type { EditRowData, FieldKey, RowData, SubCategory, TempSpecState } from './types'
import AddConfigForm from './AddConfigForm'
import EditRowCard from './EditRowCard'
import RowCard from './RowCard'

interface SubCategoryCardProps {
  categoryId: string
  sub: SubCategory
  rows: RowData[]
  isFormOpen: boolean
  editingRowId: string | null
  editRowData: EditRowData | null
  tempSpec: TempSpecState
  onToggleForm: (categoryId: string, subId: string) => void
  onStartEdit: (row: RowData) => void
  onCancelEdit: () => void
  onRemoveRow: (categoryId: string, subId: string, rowId: string) => void
  onUpdateRow: (rowId: string, quantity: number, specs: EditRowData['specs']) => void
  onUpdateEditRow: (data: EditRowData) => void
  onChangeTempQuantity: (quantity: number) => void
  onChangeTempSpec: (fieldKey: FieldKey, value: string) => void
  onAddRow: () => void
}

export default function SubCategoryCard({
  categoryId,
  sub,
  rows,
  isFormOpen,
  editingRowId,
  editRowData,
  tempSpec,
  onToggleForm,
  onStartEdit,
  onCancelEdit,
  onRemoveRow,
  onUpdateRow,
  onUpdateEditRow,
  onChangeTempQuantity,
  onChangeTempSpec,
  onAddRow,
}: SubCategoryCardProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-slate-50/50">
      <div className="border-b border-slate-200/70 bg-white px-3 py-2">
        <p className="text-sm font-semibold text-slate-700">{sub.label}</p>
      </div>

      <div className="space-y-3 p-3">
        {rows.length > 0 && (
          <div className="space-y-2">
            {rows.map((row) =>
              editingRowId === row.id && editRowData ? (
                <EditRowCard
                  key={row.id}
                  sub={sub}
                  data={editRowData}
                  onChange={onUpdateEditRow}
                  onSave={() => onUpdateRow(row.id, editRowData.quantity, editRowData.specs)}
                  onCancel={onCancelEdit}
                />
              ) : (
                <RowCard
                  key={row.id}
                  row={row}
                  sub={sub}
                  onEdit={onStartEdit}
                  onRemove={(rowId) => onRemoveRow(categoryId, sub.id, rowId)}
                  onChangeQuantity={(rowId, quantity) => onUpdateRow(rowId, quantity, row.specs)}
                />
              )
            )}
          </div>
        )}

        {!isFormOpen && (
          <button
            type="button"
            onClick={() => onToggleForm(categoryId, sub.id)}
            className="flex w-full items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white px-3 py-3 text-slate-400 transition hover:border-[rgb(var(--speedgoat-blue))] hover:text-[rgb(var(--speedgoat-blue))]"
            aria-label="Add variant"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        {isFormOpen && (
          <AddConfigForm
            sub={sub}
            tempSpec={tempSpec}
            onChangeQuantity={onChangeTempQuantity}
            onChangeSpec={onChangeTempSpec}
            onAdd={onAddRow}
            onCancel={() => onToggleForm(categoryId, sub.id)}
          />
        )}
      </div>
    </div>
  )
}
