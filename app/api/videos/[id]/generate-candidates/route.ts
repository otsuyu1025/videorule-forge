/**
 * POST /api/videos/{id}/generate-candidates
 *
 * Stage 2: Claude によるルール候補生成
 * Stage 1（OCR・文字起こし）完了後、ユーザーが内容を確認・手直しした上で
 * このエンドポイントを呼び出すことでルール候補を生成する。
 */
import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { generateRuleCandidates } from '@/lib/ai'
import { v4 as uuidv4 } from 'uuid'
import type { RuleCandidate, Source } from '@/types'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()

  const video = db.data.videos.find(v => v.id === id && !v.deletedAt)
  if (!video) return Response.json({ error: '動画が見つかりません' }, { status: 404 })

  if (video.type !== 'sample') {
    return Response.json({ error: 'お手本動画のみルール候補を生成できます' }, { status: 400 })
  }

  const feature = db.data.videoFeatures.find(f => f.videoId === id)
  if (!feature?.extractedAt) {
    return Response.json({ error: '先に動画を解析してください' }, { status: 400 })
  }

  try {
    video.status = 'generating_candidates'
    video.errorMessage = undefined
    await db.write()

    const guidelines = db.data.guidelines.filter(g => !g.deletedAt)
    const candidates = await generateRuleCandidates(feature, guidelines)

    const videoSource: Source = { type: 'sampleVideo', id: video.id, name: video.title }
    for (const c of candidates) {
      const alreadyExists = db.data.ruleCandidates.some(
        rc => rc.videoId === id && rc.content === c.content
      )
      if (!alreadyExists) {
        db.data.ruleCandidates.push({
          id: uuidv4(),
          videoId: id,
          source: videoSource,
          content: c.content,
          category: c.category,
          reason: c.reason,
          approvalStatus: 'pending',
          createdAt: new Date().toISOString(),
        } as RuleCandidate)
      }
    }

    video.status = 'analyzed'
    await db.write()

    const updatedCandidates = db.data.ruleCandidates.filter(c => c.videoId === id)
    return Response.json({ status: 'analyzed', candidates: updatedCandidates })

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const lower = msg.toLowerCase()

    let errorMessage: string
    if (lower.includes('api key') || lower.includes('auth') || lower.includes('resolve authentication')) {
      errorMessage = 'ルール候補の生成に失敗しました。.env.local の ANTHROPIC_API_KEY が正しく設定されているか確認してください。'
    } else if (lower.includes('rate limit') || lower.includes('overloaded')) {
      errorMessage = 'AIサービスが混雑しています。時間をおいてから再試行してください。'
    } else {
      errorMessage = 'ルール候補の生成に失敗しました。時間をおいてから再試行してください。'
    }

    video.status = 'awaiting_review'  // Stage 1 データは残るので awaiting_review に戻す
    video.errorMessage = errorMessage
    await db.write()
    console.error('[generate-candidates] エラー:', error)
    return Response.json({ error: errorMessage }, { status: 500 })
  }
}
