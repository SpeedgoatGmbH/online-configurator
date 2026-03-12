import type { ProposalGenerateResponse } from '@/components/configurator/proposalTypes'

export type SlotMapMachineVariant = {
  suffix: string
  maxSlots: number
}

export type SlotMapMachineContext = {
  id: string
  name: string
  image: string
  maxSlots: number
  maxSlotsExpanded: number
  keywords?: string
  blurb?: string
  variants?: SlotMapMachineVariant[]
}

export type SlotMapStoragePayload = {
  schemaVersion: '1.0.0'
  savedAt: string
  machine: SlotMapMachineContext
  proposal: ProposalGenerateResponse
}

export const SLOT_MAP_STORAGE_KEY = 'speedgoat-slot-map-context-v1'
