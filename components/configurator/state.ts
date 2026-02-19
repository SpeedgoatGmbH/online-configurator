import type { Category, FieldKey, SubCategoryState, TempSpecState } from './types'

export function createInitialState(categories: Category[]) {
  const initialState: Record<string, Record<string, SubCategoryState>> = {}
  categories.forEach((category) => {
    initialState[category.id] = {}
    category.subCategories.forEach((sub) => {
      initialState[category.id][sub.id] = {
        rows: [],
      }
    })
  })
  return initialState
}

export function createInitialTempSpecs(categories: Category[]) {
  const initial: Record<string, Record<string, TempSpecState>> = {}
  categories.forEach((category) => {
    initial[category.id] = {}
    category.subCategories.forEach((sub) => {
      initial[category.id][sub.id] = {
        quantity: 32,
        specs: { ...sub.defaults },
      }
    })
  })
  return initial
}

export function getTotalChannelsForCategory(
  state: Record<string, Record<string, SubCategoryState>>,
  categoryId: string
) {
  let total = 0
  const categoryState = state[categoryId]
  if (!categoryState) return total

  Object.values(categoryState).forEach((subState) => {
    subState.rows.forEach((row) => {
      total += row.quantity
    })
  })
  return total
}

export function isDuplicateRow(
  rows: Array<{ id?: string; quantity: number; specs: Record<FieldKey, string> }>,
  candidate: { id?: string; quantity: number; specs: Record<FieldKey, string> }
) {
  return rows.some((row) => {
    if (candidate.id && row.id === candidate.id) return false
    if (row.quantity !== candidate.quantity) return false
    return Object.keys(candidate.specs).every(
      (key) => row.specs[key as FieldKey] === candidate.specs[key as FieldKey]
    )
  })
}
