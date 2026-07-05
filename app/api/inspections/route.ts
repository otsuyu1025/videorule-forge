import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { inspectVideo } from '@/lib/ai'
import { v4 as uuidv4 } from 'uuid'
import type { VideoInspection, InspectionReport } from '@/types'

export async function GET(request: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')

  let inspections = db.data.videoInspections
  if (videoId) inspections = inspections.filter(i => i.videoId === videoId)
  inspections = inspections.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return Response.json(inspections)
}

export async function POST(request: NextRequest) {
  const db = await getDb()
  const body = await request.json()
  const { videoId } = body

  const video = db.data.videos.find(v => v.id === videoId && !v.deletedAt)
  if (!video) return Response.json({ error: '動画が見つかりません' }, { status: 404 })

  const feature = db.data.videoFeatures.find(f => f.videoId === videoId)
  if (!feature) return Response.json({ error: '動画の特徴が取得されていません。先に解析してください。' }, { status: 400 })

  const rules = db.data.productionRules.filter(r => !r.deletedAt && r.isActive)
  if (rules.length === 0) return Response.json({ error: '動画制作ルールが登録されていません' }, { status: 400 })

  const inspection: VideoInspection = {
    id: uuidv4(),
    videoId,
    status: 'running',
    results: [],
    createdAt: new Date().toISOString(),
  }
  db.data.videoInspections.push(inspection)
  await db.write()

  try {
    const results = await inspectVideo(feature, rules)
    inspection.results = results
    inspection.status = 'completed'
    inspection.completedAt = new Date().toISOString()

    const issues = results.filter(r => r.judgment === 'NG' || r.judgment === '要確認')
    const report: InspectionReport = {
      id: uuidv4(),
      inspectionId: inspection.id,
      videoId,
      issues: issues.map(i => ({
        ruleContent: i.ruleContent,
        judgment: i.judgment,
        reason: i.reason,
      })),
      suggestions: issues.map(i => i.reason),
      comments: `検査完了。${results.length}件のルールを確認しました。${issues.length}件の問題が見つかりました。`,
      createdAt: new Date().toISOString(),
    }
    db.data.inspectionReports.push(report)
    await db.write()

    return Response.json({ inspection, report }, { status: 201 })
  } catch (error) {
    inspection.status = 'error'
    await db.write()
    console.error('Inspection error:', error)
    return Response.json({ error: '検査に失敗しました' }, { status: 500 })
  }
}
