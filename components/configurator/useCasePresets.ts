import type { StarterRow } from './industries'
import type { ClosedLoopRate } from './proposalTypes'

export type UseCasePreset = {
  id: string
  title: string
  shortLabel: string
  summary: string
  machineId: string
  closedLoopRate: ClosedLoopRate
  focusTags: string[]
  detailPoints: string[]
  starterRows: StarterRow[]
}

export const USE_CASE_PRESETS: UseCasePreset[] = [
  {
    id: 'battery-management-systems',
    title: 'Battery Management Systems',
    shortLabel: 'BMS',
    summary:
      'Start from a control-oriented battery test setup with analog measurement, digital I/O, and communication opened early.',
    machineId: 'performance',
    closedLoopRate: '10k',
    focusTags: ['Analog measurement', 'CAN FD', 'Digital I/O'],
    detailPoints: [
      'Preloads a battery-test starting point instead of a blank module canvas.',
      'Keeps the machine and performance band editable after the handoff.',
      'Fits the CLogic idea of starting from the application, then refining.',
    ],
    starterRows: [
      { categoryId: 'analog', subId: 'inputs', quantity: 16, specs: {} },
      { categoryId: 'analog', subId: 'outputs', quantity: 4, specs: {} },
      { categoryId: 'digital', subId: 'inputs', quantity: 8, specs: {} },
      { categoryId: 'digital', subId: 'outputs', quantity: 8, specs: {} },
      { categoryId: 'communication', subId: 'protocols', quantity: 2, specs: { range: 'CAN FD' } },
    ],
  },
  {
    id: 'motor-controls-and-drives',
    title: 'Motor Controls & Drives',
    shortLabel: 'Drives',
    summary:
      'Start from a fast-control setup with PWM, capture, encoder feedback, and supporting analog measurement.',
    machineId: 'performance',
    closedLoopRate: '100k',
    focusTags: ['PWM', 'Capture', 'Encoder'],
    detailPoints: [
      'Sets the flow up for fast control instead of generic monitoring.',
      'Pushes the configurator toward motion and real-time electrical-control questions.',
      'Still allows the customer to adjust channel counts after the handoff.',
    ],
    starterRows: [
      { categoryId: 'analog', subId: 'inputs', quantity: 8, specs: {} },
      { categoryId: 'analog', subId: 'outputs', quantity: 4, specs: {} },
      { categoryId: 'digital', subId: 'pwm', quantity: 6, specs: {} },
      { categoryId: 'digital', subId: 'capture', quantity: 6, specs: {} },
      { categoryId: 'motion', subId: 'encoder', quantity: 2, specs: {} },
    ],
  },
  {
    id: 'power-electronics-and-inverter-control',
    title: 'Power Electronics & Inverter Control',
    shortLabel: 'Inverter',
    summary:
      'Start from a high-speed electrical-control setup that leads directly into the FPGA-heavy configuration path.',
    machineId: 'performance',
    closedLoopRate: 'above100k',
    focusTags: ['High speed', 'PWM', 'Fast analog'],
    detailPoints: [
      'Preselects the highest performance band for power-electronics style work.',
      'Gives the configurator a stronger starting signal before the user refines details.',
      'Matches the CLogic idea of using performance as the first real prefilter.',
    ],
    starterRows: [
      { categoryId: 'analog', subId: 'inputs', quantity: 8, specs: {} },
      { categoryId: 'analog', subId: 'outputs', quantity: 4, specs: {} },
      { categoryId: 'digital', subId: 'inputs', quantity: 16, specs: {} },
      { categoryId: 'digital', subId: 'outputs', quantity: 16, specs: {} },
      { categoryId: 'digital', subId: 'pwm', quantity: 6, specs: {} },
      { categoryId: 'digital', subId: 'capture', quantity: 6, specs: {} },
    ],
  },
  {
    id: 'vehicle-dynamics-controls',
    title: 'Vehicle Dynamics Controls',
    shortLabel: 'Vehicle',
    summary:
      'Start from a use-case page handoff similar to the website’s vehicle-dynamics story, then refine inside the configurator.',
    machineId: 'performance',
    closedLoopRate: '100k',
    focusTags: ['CAN FD', 'Analog I/O', 'Digital I/O'],
    detailPoints: [
      'Mocks the transition from a use-case content page into a recommended system direction.',
      'Uses a plausible starting profile for controls, communication, and supporting I/O.',
      'Keeps the machine and performance band visible as editable boundaries.',
    ],
    starterRows: [
      { categoryId: 'analog', subId: 'inputs', quantity: 8, specs: {} },
      { categoryId: 'analog', subId: 'outputs', quantity: 4, specs: {} },
      { categoryId: 'digital', subId: 'inputs', quantity: 16, specs: {} },
      { categoryId: 'digital', subId: 'outputs', quantity: 8, specs: {} },
      { categoryId: 'communication', subId: 'protocols', quantity: 4, specs: { range: 'CAN FD' } },
    ],
  },
]

export function getUseCasePreset(id: string | null | undefined): UseCasePreset | undefined {
  if (!id) return undefined
  return USE_CASE_PRESETS.find((preset) => preset.id === id)
}
