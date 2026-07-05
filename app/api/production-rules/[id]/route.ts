import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()
  const body = await request.json()

  const rule = db.data.productionRules.find(r => r.id === id)
  if (!rule) return Response.json({ error: 'ルールが見つかりません' }, { status: 404 })

  rule.history.push({ editedAt: new Date().toISOString(), content: rule.content, reason: rule.reason })
  rule.content = body.content ?? rule.content
  rule.category = body.category ?? rule.category
  rule.reason = body.reason ?? rule.reason
  rule.updatedAt = new Date().toISOString()

  await db.write()
  return Response.json(rule)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()

  const rule = db.data.productionRules.find(r => r.id === id)
  if (!rule) return Response.json({ error: 'ルールが見つかりません' }, { status: 404 })

  rule.deletedAt = new Date().toISOString()
  rule.isActive = false
  await db.write()
  return Response.json({ success: true })
}
