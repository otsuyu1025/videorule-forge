import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

const DEFAULT_REJECTED_RETENTION_DAYS = 30

export async function GET(request: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const videoId = searchParams.get('videoId')
  const guidelineId = searchParams.get('guidelineId')

  // 期限切れの却下候補をソフトデリート（一覧取得のたびに自動実行）
  const retentionDays = db.data.settings?.rejectedCandidateRetentionDays ?? DEFAULT_REJECTED_RETENTION_DAYS
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  let cleaned = 0
  for (const c of db.data.ruleCandidates) {
    if (!c.deletedAt && c.approvalStatus === 'rejected' && new Date(c.createdAt) < cutoff) {
      c.deletedAt = new Date().toISOString()
      cleaned++
    }
  }
  if (cleaned > 0) {
    await db.write()
    console.log(`[cleanup] 期限切れ却下候補を削除: ${cleaned}件 (${retentionDays}日超)`)
  }

  let candidates = db.data.ruleCandidates.filter(c => !c.deletedAt)
  if (status) candidates = candidates.filter(c => c.approvalStatus === status)
  if (videoId) candidates = candidates.filter(c => c.videoId === videoId)
  if (guidelineId) candidates = candidates.filter(c => c.guidelineId === guidelineId)
  candidates = candidates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return Response.json(candidates)
}
