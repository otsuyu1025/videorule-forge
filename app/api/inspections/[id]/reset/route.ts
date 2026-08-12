import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

/**
 * POST /api/inspections/[id]/reset
 * 検品中のまま止まった検品（running状態）をerrorにリセットして再検品できるようにする
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()

  const inspection = db.data.videoInspections.find(i => i.id === id)
  if (!inspection) {
    return Response.json({ error: '検査が見つかりません' }, { status: 404 })
  }

  if (inspection.status !== 'running') {
    return Response.json(
      { error: `リセットできません（現在のステータス: ${inspection.status}）` },
      { status: 400 }
    )
  }

  inspection.status = 'error'
  await db.write()

  return Response.json({ success: true, inspection })
}
