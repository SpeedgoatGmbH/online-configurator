export type FieldKey = 'range' | 'resolution' | 'speed' | 'signalType' | 'signalRange' | 'inputMode' | 'outputMode'

export interface ConditionalOptions {
  dependsOn: FieldKey
  conditions: Record<string, string[]>
}

export interface FieldDefinition {
  key: FieldKey
  label: string
  options: string[] | ConditionalOptions
}

export interface SubCategory {
  id: string
  label: string
  fields: FieldDefinition[]
  defaults: Record<FieldKey, string>
}

export interface Category {
  id: string
  label: string
  subCategories: SubCategory[]
}

export interface RowData {
  id: string
  quantity: number
  specs: Record<FieldKey, string>
}

export interface SubCategoryState {
  rows: RowData[]
}

export interface ConfiguratorProps {
  title: string
  description?: string
}

export interface EditRowData {
  quantity: number
  specs: Record<FieldKey, string>
}

export interface TempSpecState {
  quantity: number
  specs: Record<FieldKey, string>
}

export type SpecsRecord = Record<FieldKey, string>
