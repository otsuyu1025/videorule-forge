import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()
  const body = await request.json()

  const guideline = db.data.guidelines.find(g => g.id === id)
  if (!guideline) return Response.json({ error: 'ガイドラインが見つかりません' }, { status: 404 })

  guideline.title = body.title ?? guideline.title
  guideline.content = body.content ?? guideline.content
  guideline.updatedAt = new Date().toISOString()

  await db.write()
  return Response.json(guideline)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()

  const guideline = db.data.guidelines.find(g => g.id === id)
  if (!guideline) return Response.json({ error: 'ガイドラインが見つかりません' }, { status: 404 })

  guideline.deletedAt = new Date().toISOString()
  await db.write()
  return Response.json({ success: true })
}
