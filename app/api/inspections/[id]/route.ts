import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()
  const inspection = db.data.videoInspections.find(i => i.id === id)
  if (!inspection) return Response.json({ error: '検査が見つかりません' }, { status: 404 })
  return Response.json(inspection)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()
  const body = await request.json()

  const inspection = db.data.videoInspections.find(i => i.id === id)
  if (!inspection) return Response.json({ error: '検査が見つかりません' }, { status: 404 })

  const { ruleId, humanOverride, humanOverrideReason } = body
  const result = inspection.results.find(r => r.ruleId === ruleId)
  if (result) {
    result.humanOverride = humanOverride
    result.humanOverrideReason = humanOverrideReason
  }

  await db.write()
  return Response.json(inspection)
}
