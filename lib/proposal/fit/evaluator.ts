import { SUB_ID_TO_CODE_MODULES } from '@/lib/proposal/catalog'
import type { ModuleCatalogEntry } from '@/lib/proposal/catalog'
import type { RequirementRow } from '@/components/configurator/proposalTypes'
import { getBoardModel, getCodeModuleByName, getFitModel } from './model'
import type { FitEvaluationResult, FitSignalCapacity } from './types'

type SignalDemand = {
  type: keyof FitSignalCapacity
  quantity: number
}

const RESOURCE_KEYS = ['slices', 'lut', 'register', 'ram16', 'ram8', 'dsp'] as const

const CODE_MODULE_ALIAS_CANDIDATES: Record<string, string[]> = {
  analog: ['ADC', 'DAC'],
  pwm: ['PWM'],
  digital: ['DIO'],
  'pulse counter': ['PulseCounter', 'CAP'],
  quadrature: ['QAD', 'QAE'],
  biss: ['Biss', 'BissEncoder'],
  endat: ['Endat', 'EndatEncoder'],
  ssi: ['SSIM', 'SSIS'],
  resolver: ['ResolverEmulation', 'ResolverMeasurement'],
  spi: ['SPI', 'SPIM', 'SPIS'],
  i2c: ['I2CM', 'I2CS'],
  serial: ['Serial'],
  sent: ['SentRx', 'SentTx'],
  dshot: ['DshotTx', 'DshotRx'],
  'cam and crank': ['CRD', 'CRE'],
  'cmu emulation': ['ADBMS6832_33'],
  tpi6020: ['PMFL'],
  interrupt: ['INTA'],
}

function toProtocolText(row: RequirementRow): string {
  return Object.values(row.specs)
    .map((value) => value.toLowerCase())
    .join(' ')
}

function resolveSignalDemand(row: RequirementRow): SignalDemand | null {
  if (row.categoryId === 'analog') {
    if (row.subId === 'inputs') return { type: 'analogInputs', quantity: row.quantity }
    if (row.subId === 'outputs') return { type: 'analogOutputs', quantity: row.quantity }
  }

  if (row.categoryId === 'motion') {
    if (row.subId === 'resolver') return { type: 'resolver', quantity: row.quantity }
    if (row.subId === 'encoder') return { type: 'digitalTTL', quantity: row.quantity }
  }

  if (row.categoryId === 'digital') {
    const protocolText = toProtocolText(row)
    if (protocolText.includes('rs422') || protocolText.includes('rs485')) {
      return { type: 'digitalRs422', quantity: row.quantity }
    }
    if (protocolText.includes('lvds')) return { type: 'digitalLvds', quantity: row.quantity }
    return { type: 'digitalTTL', quantity: row.quantity }
  }

  if (row.categoryId === 'communication' && row.subId === 'protocols') {
    const protocolText = toProtocolText(row)
    if (protocolText.includes('rs-422') || protocolText.includes('rs422') || protocolText.includes('rs-485') || protocolText.includes('rs485')) {
      return { type: 'digitalRs422', quantity: row.quantity }
    }
    if (protocolText.includes('spi') || protocolText.includes('i2c') || protocolText.includes('serial')) {
      return { type: 'digitalTTL', quantity: row.quantity }
    }
  }

  // Handle remapped protocol subIds (e.g. effectiveRow with subId='spi' from FPGA protocol routing)
  if (row.subId === 'spi' || row.subId === 'i2c' || row.subId === 'serial') {
    return { type: 'digitalTTL', quantity: row.quantity }
  }
  if (row.subId === 'sent' || row.subId === 'dshot') {
    return { type: 'digitalTTL', quantity: row.quantity }
  }

  if (row.subId === 'pwm' || row.subId === 'capture' || row.subId === 'gpio' || row.subId === 'gen_purpose') {
    const protocolText = toProtocolText(row)
    if (protocolText.includes('rs422') || protocolText.includes('rs485')) {
      return { type: 'digitalRs422', quantity: row.quantity }
    }
    if (protocolText.includes('lvds')) return { type: 'digitalLvds', quantity: row.quantity }
    return { type: 'digitalTTL', quantity: row.quantity }
  }

  return null
}

function getExtensionPreferenceForDemand(signalType: keyof FitSignalCapacity): string[] {
  if (signalType === 'analogInputs' || signalType === 'analogOutputs') return ['-120']
  if (signalType === 'resolver') return ['-24']
  if (signalType === 'digitalRs422') return ['-22', '-24']
  if (signalType === 'digitalTTL') return ['-21', '-22', '-24']
  return []
}

export function getCodeModuleCandidatesForRow(row: RequirementRow): string[] {
  const required = SUB_ID_TO_CODE_MODULES[row.subId] ?? []
  const candidates: string[] = []
  for (const label of required) {
    const aliases = CODE_MODULE_ALIAS_CANDIDATES[label.toLowerCase()] ?? [label]
    for (const alias of aliases) candidates.push(alias)
  }

  if (row.categoryId === 'analog' && candidates.length === 0) {
    candidates.push(row.subId === 'outputs' ? 'DAC' : 'ADC')
  }

  if (candidates.length === 0 && row.subId === 'resolver') {
    candidates.push('ResolverEmulation', 'ResolverMeasurement')
  }

  return candidates
}

export function resolveFitCodeModuleForRow(row: RequirementRow) {
  const candidates = getCodeModuleCandidatesForRow(row)
  for (const candidate of candidates) {
    const codeModule = getCodeModuleByName(candidate)
    if (codeModule?.mappable) return codeModule
  }
  return null
}

/**
 * Check if a board in the fit model can accommodate at least one code module
 * candidate for a requirement row, based on FPGA resource feasibility.
 *
 * Returns:
 * - `true`  — at least one candidate fits within the board's FPGA resources
 * - `false` — all candidates with resource data exceed the board's resources
 * - `null`  — indeterminate (board not found, zero resources, or no resource data for candidates)
 */
export function isFitCodeModuleCompatibleWithBoard(
  boardModelId: string,
  row: RequirementRow
): boolean | null {
  const board = getBoardModel(boardModelId)
  if (!board) return null

  const hasResources = RESOURCE_KEYS.some(k => board.resources[k] > 0)
  if (!hasResources) return null

  const candidates = getCodeModuleCandidatesForRow(row)
  if (candidates.length === 0) return null

  let anyHasResourceData = false

  for (const candidateName of candidates) {
    const cm = getCodeModuleByName(candidateName)
    if (!cm?.mappable) continue

    // Check if code module has non-zero resource requirements
    const hasResourceReqs = RESOURCE_KEYS.some(k =>
      cm.resources.base[k] + cm.resources.perChannel[k] > 0
    )
    if (!hasResourceReqs) continue // No resource data for this code module — skip
    anyHasResourceData = true

    // Check if at least 1 channel fits in the board's resources
    let feasible = true
    for (const key of RESOURCE_KEYS) {
      const used = cm.resources.base[key] + cm.resources.perChannel[key] * 1
      if (used <= 0) continue
      if (board.resources[key] <= 0 || used > board.resources[key]) {
        feasible = false
        break
      }
    }
    if (feasible) return true
  }

  // If no candidates had resource data, we can't determine
  if (!anyHasResourceData) return null

  // All candidates with resource data exceeded board resources
  return false
}

/**
 * Compute the effective signal capacity for a module given a requirement row,
 * using the fit model's board signal capacity data plus interfaces and extensions.
 *
 * Returns the max channel count across base board, best interface, and best
 * extension for the resolved signal type — or `null` if the fit model
 * cannot determine it (board not found, demand not resolved, zero capacity).
 */
export function getEffectiveSignalCapacity(
  module: ModuleCatalogEntry,
  row: RequirementRow
): number | null {
  const demand = resolveSignalDemand(row)
  if (!demand) return null

  const boardLookupId = module.fpgaFamily ?? module.moduleId
  const board = getBoardModel(boardLookupId)
  if (!board) return null

  const fitModel = getFitModel()
  const baseCapacity = board.signalCapacity[demand.type] ?? 0
  let maxCapacity = baseCapacity

  // Interface boards (IO332/IO333)
  if (module.supportsIOInterfaces === true) {
    const interfaceIds = board.supportedInterfaces.length > 0
      ? board.supportedInterfaces
      : board.supportsFrontPlugin
      ? Object.keys(fitModel.interfaces)
      : []
    for (const interfaceId of interfaceIds) {
      const capability = fitModel.interfaces[interfaceId]
      if (!capability) continue
      maxCapacity = Math.max(maxCapacity, capability[demand.type] ?? 0)
    }
  }

  // Extension boards
  const preferredExtensions = getExtensionPreferenceForDemand(demand.type)
  if (preferredExtensions.length > 0 && module.supportsIOExtensions !== false) {
    const boardSupported = board.supportedExtensions
    for (const extensionId of preferredExtensions) {
      if (boardSupported.length > 0 && !boardSupported.includes(extensionId)) continue
      const capability = fitModel.extensions[extensionId]
      if (!capability) continue
      maxCapacity = Math.max(maxCapacity, capability[demand.type] ?? 0)
    }
  }

  return maxCapacity > 0 ? maxCapacity : null
}

export function evaluateModuleFit(
  row: RequirementRow,
  module: ModuleCatalogEntry,
  units: number
): FitEvaluationResult {
  const reasons: FitEvaluationResult['reasons'] = []
  const boardLookupId = module.fpgaFamily ?? module.moduleId
  const board = getBoardModel(boardLookupId)
  const demand = resolveSignalDemand(row)

  if (!demand) {
    return {
      pass: true,
      failOpen: true,
      confidence: 'partial',
      reasons: ['unknown_mapping'],
    }
  }

  if (!board) {
    return {
      pass: true,
      failOpen: true,
      confidence: 'partial',
      reasons: ['board_not_found', 'missing_fit_data'],
      signalDemandType: demand.type,
      signalDemandQty: demand.quantity,
    }
  }

  const fitModel = getFitModel()
  const baseCapacity = board.signalCapacity[demand.type] ?? 0
  let maxCapacity = baseCapacity

  if (module.supportsIOInterfaces === true) {
    const interfaceIds = board.supportedInterfaces.length > 0
      ? board.supportedInterfaces
      : board.supportsFrontPlugin
      ? Object.keys(fitModel.interfaces)
      : []
    if (interfaceIds.length === 0 && baseCapacity < demand.quantity) {
      return {
        pass: false,
        failOpen: false,
        confidence: 'high',
        reasons: ['unsupported_plugin'],
        resolvedBoardModel: board.boardModel,
        signalDemandType: demand.type,
        signalDemandQty: demand.quantity,
      }
    }
    for (const interfaceId of interfaceIds) {
      const capability = fitModel.interfaces[interfaceId]
      if (!capability) continue
      maxCapacity = Math.max(maxCapacity, capability[demand.type] ?? 0)
    }
  }

  const preferredExtensions = getExtensionPreferenceForDemand(demand.type)
  if (preferredExtensions.length > 0) {
    if (module.supportsIOExtensions === false && maxCapacity < demand.quantity) {
      return {
        pass: false,
        failOpen: false,
        confidence: 'high',
        reasons: ['unsupported_extension'],
        resolvedBoardModel: board.boardModel,
        signalDemandType: demand.type,
        signalDemandQty: demand.quantity,
      }
    }
    if (module.supportsIOExtensions !== false) {
      const boardSupported = board.supportedExtensions
      for (const extensionId of preferredExtensions) {
        if (boardSupported.length > 0 && !boardSupported.includes(extensionId)) continue
        const capability = fitModel.extensions[extensionId]
        if (!capability) continue
        maxCapacity = Math.max(maxCapacity, capability[demand.type] ?? 0)
      }
    }
  }

  if (module.channelCapacity <= 0) {
    return {
      pass: false,
      failOpen: false,
      confidence: 'high',
      reasons: ['insufficient_base_channels'],
      resolvedBoardModel: board.boardModel,
      signalDemandType: demand.type,
      signalDemandQty: demand.quantity,
    }
  }

  if (maxCapacity > 0 && maxCapacity < demand.quantity) {
    return {
      pass: false,
      failOpen: false,
      confidence: 'high',
      reasons: ['insufficient_signal_channels'],
      resolvedBoardModel: board.boardModel,
      signalDemandType: demand.type,
      signalDemandQty: demand.quantity,
    }
  }

  if (!module.fpgaFamily) {
    return {
      pass: true,
      failOpen: false,
      confidence: 'high',
      reasons,
      resolvedBoardModel: board.boardModel,
      signalDemandType: demand.type,
      signalDemandQty: demand.quantity,
    }
  }

  const codeModule = resolveFitCodeModuleForRow(row)
  if (!codeModule) {
    return {
      pass: true,
      failOpen: true,
      confidence: 'partial',
      reasons: ['unknown_mapping'],
      resolvedBoardModel: board.boardModel,
      signalDemandType: demand.type,
      signalDemandQty: demand.quantity,
    }
  }

  const effectiveChannels = row.quantity
  if (typeof codeModule.maxChannels === 'number' && codeModule.maxChannels > 0 && effectiveChannels > codeModule.maxChannels * units) {
    return {
      pass: false,
      failOpen: false,
      confidence: 'high',
      reasons: ['insufficient_base_channels'],
      resolvedBoardModel: board.boardModel,
      signalDemandType: demand.type,
      signalDemandQty: demand.quantity,
      codeModuleName: codeModule.name,
      effectiveChannels,
    }
  }

  for (const resourceKey of RESOURCE_KEYS) {
    const used = codeModule.resources.base[resourceKey] + codeModule.resources.perChannel[resourceKey] * effectiveChannels
    const available = board.resources[resourceKey] * Math.max(1, units)
    if (used <= 0) continue
    if (available <= 0) {
      return {
        pass: true,
        failOpen: true,
        confidence: 'partial',
        reasons: ['missing_fit_data'],
        resolvedBoardModel: board.boardModel,
        signalDemandType: demand.type,
        signalDemandQty: demand.quantity,
        codeModuleName: codeModule.name,
        effectiveChannels,
      }
    }
    if (used > available) {
      return {
        pass: false,
        failOpen: false,
        confidence: 'high',
        reasons: ['fpga_resource_exceeded'],
        resolvedBoardModel: board.boardModel,
        signalDemandType: demand.type,
        signalDemandQty: demand.quantity,
        codeModuleName: codeModule.name,
        effectiveChannels,
      }
    }
  }

  return {
    pass: true,
    failOpen: false,
    confidence: 'high',
    reasons,
    resolvedBoardModel: board.boardModel,
    signalDemandType: demand.type,
    signalDemandQty: demand.quantity,
    codeModuleName: codeModule.name,
    effectiveChannels,
  }
}
