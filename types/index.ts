export interface ProductConfig {
  id: string
  name: string
  description: string
}

export interface ConfiguratorState {
  selectedProduct?: ProductConfig
  options: Record<string, any>
}
