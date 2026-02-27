import { NextResponse } from 'next/server'
import { getSimulationDelayMs, simulateProposal } from '@/lib/proposal/simulator'
import type { ProposalGenerateRequest } from '@/components/configurator/proposalTypes'

function isValidGenerateRequest(payload: unknown): payload is ProposalGenerateRequest {
  if (!payload || typeof payload !== 'object') return false
  const candidate = payload as ProposalGenerateRequest

  if (!candidate.machineId || typeof candidate.machineId !== 'string') return false
  if (!candidate.machineName || typeof candidate.machineName !== 'string') return false
  if (!candidate.version || typeof candidate.version !== 'string') return false
  if (!Array.isArray(candidate.requirements)) return false
  if (candidate.requirements.length === 0) return false

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
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

  const delayMs = getSimulationDelayMs(payload)
  await sleep(delayMs)
  const proposal = simulateProposal(payload)

  return NextResponse.json(proposal)
}
