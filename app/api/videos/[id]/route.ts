import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()
  const video = db.data.videos.find(v => v.id === id && !v.deletedAt)
  if (!video) return Response.json({ error: '動画が見つかりません' }, { status: 404 })
  return Response.json(video)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()
  const body = await request.json()

  const video = db.data.videos.find(v => v.id === id && !v.deletedAt)
  if (!video) return Response.json({ error: '動画が見つかりません' }, { status: 404 })

  if (body.title !== undefined) video.title = body.title
  await db.write()
  return Response.json(video)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()
  const video = db.data.videos.find(v => v.id === id)
  if (!video) return Response.json({ error: '動画が見つかりません' }, { status: 404 })

  video.deletedAt = new Date().toISOString()
  await db.write()
  return Response.json({ success: true })
}
