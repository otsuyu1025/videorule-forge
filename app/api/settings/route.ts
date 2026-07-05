import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET() {
  const db = await getDb()
  return Response.json(db.data.settings ?? {})
}

export async function PUT(request: NextRequest) {
  const db = await getDb()
  const body = await request.json()

  if (!db.data.settings) db.data.settings = {}
  Object.assign(db.data.settings, body)
  await db.write()

  return Response.json(db.data.settings)
}
