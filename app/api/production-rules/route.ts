import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import type { ProductionRule } from '@/types'

export async function GET() {
  const db = await getDb()
  const rules = db.data.productionRules
    .filter(r => !r.deletedAt && r.isActive)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return Response.json(rules)
}

export async function POST(request: NextRequest) {
  const db = await getDb()
  const body = await request.json()

  const rule: ProductionRule = {
    id: uuidv4(),
    content: body.content,
    category: body.category || 'その他',
    reason: body.reason || '',
    isActive: true,
    history: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  db.data.productionRules.push(rule)
  await db.write()

  return Response.json(rule, { status: 201 })
}
