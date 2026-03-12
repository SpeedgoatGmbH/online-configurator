import { NextResponse } from 'next/server'
import { simulateProposal } from '@/lib/proposal/simulator'
import type { OptimizationProfile, ProposalGenerateRequest } from '@/components/configurator/proposalTypes'

const OPTIMIZATION_PROFILES: OptimizationProfile[] = ['balanced', 'min_modules', 'prefer_fpga']

function isOptimizationProfile(value: unknown): value is OptimizationProfile {
  return typeof value === 'string' && OPTIMIZATION_PROFILES.includes(value as OptimizationProfile)
}

function isValidGenerateRequest(payload: unknown): payload is ProposalGenerateRequest {
  if (!payload || typeof payload !== 'object') return false
  const candidate = payload as ProposalGenerateRequest

  if (!candidate.machineId || typeof candidate.machineId !== 'string') return false
  if (!candidate.machineName || typeof candidate.machineName !== 'string') return false
  if (!candidate.version || typeof candidate.version !== 'string') return false
  if (!Array.isArray(candidate.requirements)) return false
  if (candidate.requirements.length === 0) return false
  if (candidate.optimizationProfile !== undefined && !isOptimizationProfile(candidate.optimizationProfile)) return false

  return candidate.requirements.every((row) => {
    if (!row || typeof row !== 'object') return false
    if (!row.categoryId || typeof row.categoryId !== 'string') return false
    if (!row.subId || typeof row.subId !== 'string') return false
    if (!row.rowId || typeof row.rowId !== 'string') return false
    if (typeof row.quantity !== 'number' || !Number.isFinite(row.quantity) || row.quantity <= 0) return false
    if (!row.specs || typeof row.specs !== 'object') return false
    return true
  })
}

export async function POST(request: Request) {
  let payload: unknown

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      {
        error: 'Invalid JSON payload.',
      },
      { status: 400 }
    )
  }

  if (!isValidGenerateRequest(payload)) {
    return NextResponse.json(
      {
        error: 'Invalid proposal request. Provide machine and at least one requirement row.',
      },
      { status: 400 }
    )
  }

  const proposal = simulateProposal(payload)

  return NextResponse.json(proposal)
}
