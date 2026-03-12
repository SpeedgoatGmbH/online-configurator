/**
 * Industry definitions for V5 configurator.
 *
 * Each industry carries:
 *  – a display label and short description
 *  – `relevantCategories`   → category IDs promoted to tier-1 when this industry is active
 *  – `highlightedProtocols` → protocols surfaced first in the protocol selector
 *  – `starterTemplate`      → optional pre-filled rows the user can load with one click
 *  – `badges`               → short labels shown on subcategories that are especially common
 */

import type { SpecsRecord } from './types'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface StarterRow {
  categoryId: string
  subId: string
  quantity: number
  specs: Partial<SpecsRecord>
}

export interface IndustryDefinition {
  id: string
  label: string
  icon: string          // emoji stand-in; could become an SVG path later
  description: string
  /** Category IDs promoted into primary view when this industry is selected */
  relevantCategories: string[]
  /** Protocols shown first / highlighted in the protocol selector */
  highlightedProtocols: string[]
  /** Subcategory IDs that get a "Common" badge */
  commonSubCategories: string[]
  /** Optional starter template rows */
  starterTemplate?: StarterRow[]
}

// ─── Definitions ────────────────────────────────────────────────────────────────

export const INDUSTRIES: IndustryDefinition[] = [
  {
    id: 'automotive',
    label: 'Automotive',
    icon: '🚗',
    description: 'Powertrain, ADAS, body electronics, BMS and e-mobility HIL testing.',
    relevantCategories: ['analog', 'digital', 'communication', 'motion', 'fault', 'highvoltage'],
    highlightedProtocols: [
      'CAN', 'CAN FD', 'LIN', 'FlexRay', 'SENT', 'PSI5',
      'Automotive Ethernet', 'XCP over CAN', 'XCP over Ethernet',
    ],
    commonSubCategories: ['inputs', 'outputs', 'protocols', 'encoder', 'relays'],
    starterTemplate: [
      { categoryId: 'analog', subId: 'inputs', quantity: 16, specs: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' } },
      { categoryId: 'analog', subId: 'outputs', quantity: 8, specs: { outputMode: 'Single-ended', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' } },
      { categoryId: 'digital', subId: 'inputs', quantity: 16, specs: { signalType: 'TTL / Discrete', range: '5 V TTL', resolution: 'None' } },
      { categoryId: 'digital', subId: 'outputs', quantity: 16, specs: { signalType: 'TTL / Discrete', range: '5 V TTL', resolution: 'None', speed: 'Push-pull' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 4, specs: { range: 'CAN FD', resolution: 'HS CAN FD', speed: '2 Mbit/s' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 2, specs: { range: 'LIN', resolution: 'LIN', speed: '19.2 kbit/s' } },
      { categoryId: 'fault', subId: 'relays', quantity: 8, specs: { range: 'SPDT', speed: '120 V AC' } },
    ],
  },
  {
    id: 'aerospace',
    label: 'Aerospace & Defense',
    icon: '✈️',
    description: 'Avionics, flight-control, MIL-spec I/O and environmental simulation.',
    relevantCategories: ['analog', 'digital', 'communication', 'motion', 'temperature', 'fault'],
    highlightedProtocols: [
      'AFDX (ARINC 664 P7)', 'ARINC 429', 'ARINC 629', 'ARINC 825',
      'MIL-STD-1553', 'RS-422', 'RS-485',
    ],
    commonSubCategories: ['inputs', 'outputs', 'protocols', 'resolver', 'measurement'],
    starterTemplate: [
      { categoryId: 'analog', subId: 'inputs', quantity: 32, specs: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' } },
      { categoryId: 'analog', subId: 'outputs', quantity: 16, specs: { outputMode: 'Single-ended', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 2, specs: { range: 'ARINC 429', resolution: 'ARINC 429', speed: '100 kbit/s' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 1, specs: { range: 'MIL-STD-1553', resolution: 'MIL-STD-1553', speed: '1 Mbit/s' } },
      { categoryId: 'motion', subId: 'resolver', quantity: 4, specs: { range: 'Single-speed', speed: '5 kHz', resolution: '14-bit' } },
    ],
  },
  {
    id: 'energy',
    label: 'Energy & Power',
    icon: '⚡',
    description: 'Power electronics, grid simulation, inverter control and battery testing.',
    relevantCategories: ['analog', 'digital', 'communication', 'highvoltage', 'temperature'],
    highlightedProtocols: [
      'EtherCAT', 'IEC 61850', 'Modbus TCP', 'Modbus RTU', 'DNP3',
      'CAN', 'CAN FD', 'PROFINET',
    ],
    commonSubCategories: ['inputs', 'outputs', 'protocols', 'measurement', 'switching'],
    starterTemplate: [
      { categoryId: 'analog', subId: 'inputs', quantity: 16, specs: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' } },
      { categoryId: 'highvoltage', subId: 'measurement', quantity: 4, specs: { range: '0–600 V', speed: '10 kHz' } },
      { categoryId: 'highvoltage', subId: 'switching', quantity: 6, specs: { range: 'IGBT', speed: '50 kHz' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 1, specs: { range: 'EtherCAT', resolution: '100BASE-TX', speed: '100 Mbit/s' } },
      { categoryId: 'temperature', subId: 'measurement', quantity: 8, specs: { range: 'Thermocouple', speed: '100 Hz' } },
    ],
  },
  {
    id: 'industrial',
    label: 'Industrial Automation',
    icon: '🏭',
    description: 'PLC testing, motor drives, fieldbus and process-control validation.',
    relevantCategories: ['analog', 'digital', 'communication', 'motion', 'temperature'],
    highlightedProtocols: [
      'EtherCAT', 'PROFINET', 'EtherNet/IP', 'POWERLINK',
      'CANopen', 'PROFIBUS', 'Modbus RTU', 'Modbus TCP', 'OPC UA',
    ],
    commonSubCategories: ['inputs', 'outputs', 'protocols', 'encoder'],
    starterTemplate: [
      { categoryId: 'analog', subId: 'inputs', quantity: 8, specs: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' } },
      { categoryId: 'analog', subId: 'outputs', quantity: 4, specs: { outputMode: 'Single-ended', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' } },
      { categoryId: 'digital', subId: 'inputs', quantity: 16, specs: { signalType: 'TTL / Discrete', range: '5 V TTL', resolution: 'None' } },
      { categoryId: 'digital', subId: 'outputs', quantity: 16, specs: { signalType: 'TTL / Discrete', range: '5 V TTL', resolution: 'None', speed: 'Push-pull' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 1, specs: { range: 'EtherCAT', resolution: '100BASE-TX', speed: '100 Mbit/s' } },
      { categoryId: 'motion', subId: 'encoder', quantity: 2, specs: { range: 'Incremental', speed: '100 kHz', resolution: '16-bit' } },
    ],
  },
  {
    id: 'academia',
    label: 'Academia & Education',
    icon: '🎓',
    description: 'Teaching labs, student projects and research prototyping.',
    relevantCategories: ['analog', 'digital', 'communication', 'motion'],
    highlightedProtocols: [
      'CAN', 'CAN FD', 'EtherCAT', 'SPI', 'I2C', 'RS-232',
    ],
    commonSubCategories: ['inputs', 'outputs', 'protocols', 'encoder'],
    starterTemplate: [
      { categoryId: 'analog', subId: 'inputs', quantity: 8, specs: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' } },
      { categoryId: 'analog', subId: 'outputs', quantity: 4, specs: { outputMode: 'Single-ended', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '100 kHz' } },
      { categoryId: 'digital', subId: 'inputs', quantity: 8, specs: { signalType: 'TTL / Discrete', range: '5 V TTL', resolution: 'None' } },
      { categoryId: 'digital', subId: 'outputs', quantity: 8, specs: { signalType: 'TTL / Discrete', range: '5 V TTL', resolution: 'None', speed: 'Push-pull' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 2, specs: { range: 'CAN', resolution: 'HS CAN', speed: '500 kbit/s' } },
    ],
  },
  {
    id: 'medical',
    label: 'Medical Devices',
    icon: '🏥',
    description: 'Patient monitoring, infusion pumps and diagnostic equipment testing.',
    relevantCategories: ['analog', 'digital', 'communication', 'temperature', 'strain'],
    highlightedProtocols: [
      'RS-232', 'RS-485', 'SPI', 'I2C', 'CAN', 'Ethernet/IP',
    ],
    commonSubCategories: ['inputs', 'outputs', 'protocols', 'measurement', 'strain'],
    starterTemplate: [
      { categoryId: 'analog', subId: 'inputs', quantity: 16, specs: { inputMode: 'Differential', signalType: 'Voltage', signalRange: '±10 V', resolution: '24-bit', speed: '20 kHz' } },
      { categoryId: 'analog', subId: 'outputs', quantity: 8, specs: { outputMode: 'Single-ended', signalType: 'Voltage', signalRange: '±10 V', resolution: '16-bit', speed: '20 kHz' } },
      { categoryId: 'temperature', subId: 'measurement', quantity: 4, specs: { range: 'RTD', speed: '100 Hz' } },
      { categoryId: 'communication', subId: 'protocols', quantity: 1, specs: { range: 'RS-232', resolution: 'RS-232', speed: '115.2 kbit/s' } },
    ],
  },
]

// ─── Helpers ────────────────────────────────────────────────────────────────────

/** Returns the industry definition or undefined */
export function getIndustry(id: string): IndustryDefinition | undefined {
  return INDUSTRIES.find((ind) => ind.id === id)
}

/** Check whether a subcategory is "common" for the selected industry */
export function isCommonSub(industryId: string | null, subId: string): boolean {
  if (!industryId) return false
  const ind = getIndustry(industryId)
  return ind?.commonSubCategories.includes(subId) ?? false
}

/** Reorder protocol options: highlighted ones first, rest after, in original order */
export function reorderProtocols(allProtocols: string[], industryId: string | null): string[] {
  if (!industryId) return allProtocols
  const ind = getIndustry(industryId)
  if (!ind) return allProtocols

  const highlighted = new Set(ind.highlightedProtocols)
  const first = allProtocols.filter((p) => highlighted.has(p))
  const rest = allProtocols.filter((p) => !highlighted.has(p))
  return [...first, ...rest]
}
