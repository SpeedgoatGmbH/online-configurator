import fitModelJson from '@/lib/proposal/generated/fitModel.json'
import type { FitBoardModel, FitCodeModule, FitModel } from './types'

const FIT_MODEL = fitModelJson as FitModel

export function getFitModel(): FitModel {
  return FIT_MODEL
}

export function resolveBoardModelId(moduleId: string): string | null {
  const direct = FIT_MODEL.moduleAliases[moduleId]
  if (direct) return direct
  return FIT_MODEL.boards[moduleId] ? moduleId : null
}

export function getBoardModel(moduleId: string): FitBoardModel | null {
  const boardId = resolveBoardModelId(moduleId)
  if (!boardId) return null
  return FIT_MODEL.boards[boardId] ?? null
}

export function normalizeCodeModuleName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function getCodeModuleByName(name: string): FitCodeModule | null {
  const normalized = normalizeCodeModuleName(name)
  return FIT_MODEL.codeModules[normalized] ?? null
}
