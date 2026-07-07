import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { generateRuleCandidatesFromGuideline } from '@/lib/ai'
import { v4 as uuidv4 } from 'uuid'
import type { RuleCandidate, Source } from '@/types'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()

  const guideline = db.data.guidelines.find(g => g.id === id && !g.deletedAt)
  if (!guideline) return Response.json({ error: 'ガイドラインが見つかりません' }, { status: 404 })

  if (!guideline.content) {
    return Response.json({ error: 'テキスト内容が取得できていません。.txtファイルのみ自動解析できます。' }, { status: 400 })
  }

  try {
    const candidates = await generateRuleCandidatesFromGuideline(guideline)

    const source: Source = {
      type: 'guideline',
      id: guideline.id,
      name: guideline.fileName || guideline.title,
    }

    const created: RuleCandidate[] = []
    for (const c of candidates) {
      const candidate: RuleCandidate = {
        id: uuidv4(),
        guidelineId: guideline.id,
        source,
        content: c.content,
        category: c.category,
        reason: c.reason,
        approvalStatus: 'pending',
        createdAt: new Date().toISOString(),
      }
      db.data.ruleCandidates.push(candidate)
      created.push(candidate)
    }

    await db.write()
    return Response.json(created, { status: 201 })
  } catch (error) {
    console.error('Guideline analysis error:', error)
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'TOKEN_LIMIT_EXCEEDED') {
      return Response.json({
        error: 'ガイドラインのテキストが長すぎて処理できませんでした。テキストを分割して複数ファイルに分けてアップロードしてください。',
      }, { status: 422 })
    }
    if (msg === 'JSON_PARSE_FAILED') {
      return Response.json({
        error: 'AIの応答を正しく解析できませんでした。もう一度お試しください。',
      }, { status: 500 })
    }
    return Response.json({ error: 'ルール候補の生成に失敗しました。時間をおいてから再度お試しください。' }, { status: 500 })
  }
}
