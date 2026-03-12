export type FieldKey = 'range' | 'resolution' | 'speed' | 'signalType' | 'signalRange' | 'inputMode' | 'outputMode'
export type SpecsRecord = Partial<Record<FieldKey, string>>

export interface ConditionalOptions {
  dependsOn: FieldKey
  conditions: Record<string, string[]>
}

export interface FieldDefinition {
  key: FieldKey
  label: string
  options: string[] | ConditionalOptions
  /** Hover-help text shown next to the field label */
  tooltip?: string
}

export interface SubCategory {
  id: string
  label: string
  fields: FieldDefinition[]
  defaults: SpecsRecord
  /** Default channel count shown when adding a new card (falls back to 32) */
  defaultQuantity?: number
}

export interface Category {
  id: string
  label: string
  subCategories: SubCategory[]
}

export interface RowData {
  id: string
  quantity: number
  specs: SpecsRecord
}

export interface SubCategoryState {
  rows: RowData[]
}

export interface ConfiguratorProps {
  title?: string
  description?: string
}

export interface EditRowData {
  quantity: number
  specs: SpecsRecord
}

export interface TempSpecState {
  quantity: number
  specs: SpecsRecord
}
