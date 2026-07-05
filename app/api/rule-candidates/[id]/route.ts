import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import type { ProductionRule } from '@/types'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()
  const body = await request.json()

  const candidate = db.data.ruleCandidates.find(c => c.id === id)
  if (!candidate) return Response.json({ error: 'ルール候補が見つかりません' }, { status: 404 })

  const prevStatus = candidate.approvalStatus
  candidate.approvalStatus = body.approvalStatus ?? candidate.approvalStatus
  if (body.content) candidate.content = body.content
  if (body.reason) candidate.reason = body.reason
  candidate.reviewedAt = new Date().toISOString()

  if (candidate.approvalStatus === 'approved' && prevStatus !== 'approved') {
    const rule: ProductionRule = {
      id: uuidv4(),
      content: candidate.content,
      category: candidate.category,
      reason: candidate.reason,
      isActive: true,
      history: [],
      source: candidate.source,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    db.data.productionRules.push(rule)
  }

  await db.write()
  return Response.json(candidate)
}
