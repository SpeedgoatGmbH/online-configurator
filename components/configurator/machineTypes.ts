// Speedgoat Machine Models Data
// Generated from Gold Lake database

export interface MachineModel {
  id: string
  name: string
  technical_name: string | null
  description: string | null
}

export interface MachineType {
  code: string
  displayName: string
  description: string
  models: MachineModel[]
}

// Main machine types with friendly names
export const MACHINE_TYPES: MachineType[] = [
  {
    code: 'BL',
    displayName: 'Baseline',
    description: 'Cost-effective real-time testing with essential performance',
    models: [] // Will be populated from API/database
  },
  {
    code: 'PERF',
    displayName: 'Performance',
    description: 'High-performance systems for demanding applications',
    models: []
  },
  {
    code: 'MOBI',
    displayName: 'Mobile',
    description: 'Portable real-time target machines for field testing',
    models: []
  },
  {
    code: 'EDU',
    displayName: 'Education',
    description: 'Educational systems for academia and training',
    models: []
  },
  {
    code: 'AUTO',
    displayName: 'Automation',
    description: 'Industrial automation and production testing', 
    models: []
  },
  {
    code: 'CLAS',
    displayName: 'Classic',
    description: 'Proven legacy platform for established workflows',
    models: []
  },
  {
    code: 'MODU',
    displayName: 'Modular',
    description: 'Expandable PXI-based systems with maximum flexibility',
    models: []
  },
  {
    code: 'OPENF',
    displayName: 'Openframe',
    description: 'Compact open-chassis design for custom integration',
    models: []
  },
  {
    code: 'UNIT',
    displayName: 'Unit',
    description: 'Standalone compact systems',
    models: []
  }
]

// Summary counts from database (as of Feb 2026)
export const MACHINE_SUMMARY = {
  totalModels: 143,
  typeCount: 14,
  types: {
    'PERF': 49,  // Performance
    'MOBI': 31,  // Mobile
    'BL': 13,    // Baseline
    'AUTO': 11,  // Automation
    'UNIT': 9,   // Unit
    'MODU': 7,   // Modular
    'OPENF': 6,  // Openframe
    'EDU': 5,    // Education
    'CLAS': 4,   // Classic
    'BASI': 2,   // Basic
    'CUSTOM': 2,
    'MODU/2': 2,
    'BASI/2': 1,
    'PULSE': 1
  }
}

// Popular configurations (examples)
export const RECOMMENDED_CONFIGS = [
  {
    type: 'BL',
    model: '107100',
    name: 'Baseline S',
    useCase: 'Entry-level HIL testing',
    estimatedPrice: 'Contact Sales'
  },
  {
    type: 'PERF',
    model: '109000',
    name: 'Performance',
    useCase: 'Advanced automotive ECU testing',
    estimatedPrice: 'Contact Sales'
  },
  {
    type: 'MOBI',
    model: '105001',
    name: 'Mobile',
    useCase: 'In-vehicle testing and data acquisition',
    estimatedPrice: 'Contact Sales'
  },
  {
    type: 'EDU',
    model: '108000',
    name: 'Education',
    useCase: 'University labs and research',
    estimatedPrice: 'Contact Sales'
  }
]
