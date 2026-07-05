import { NextRequest, NextResponse } from 'next/server'
import { deleteExpiredFrames, isR2Enabled } from '@/lib/storage/r2'
import { getDb } from '@/lib/db'

const DEFAULT_RETENTION_DAYS = 30

// docker-compose のクロンコンテナ（または手動）から叩くクリーンアップエンドポイント
// 内部呼び出し専用: CLEANUP_SECRET 環境変数で保護
export async function POST(request: NextRequest) {
  const secret = process.env.CLEANUP_SECRET
  if (secret) {
    const auth = request.headers.get('x-cleanup-secret')
    if (auth !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!isR2Enabled()) {
    return NextResponse.json({ skipped: true, reason: 'R2 not configured' })
  }

  const db = await getDb()
  const retentionDays = db.data.settings?.frameRetentionDays ?? DEFAULT_RETENTION_DAYS

  const result = await deleteExpiredFrames(retentionDays)

  return NextResponse.json({
    ok: true,
    retentionDays,
    ...result,
    timestamp: new Date().toISOString(),
  })
}

// 最後のクリーンアップ結果を確認用（ヘルスチェックから参照可能）
export async function GET() {
  if (!isR2Enabled()) {
    return NextResponse.json({ r2Enabled: false })
  }
  const db = await getDb()
  const retentionDays = db.data.settings?.frameRetentionDays ?? DEFAULT_RETENTION_DAYS
  return NextResponse.json({ r2Enabled: true, retentionDays })
}
