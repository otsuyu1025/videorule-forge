import { NextRequest } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { getDb } from '@/lib/db'
import { inspectVideo, inspectYakuji } from '@/lib/ai'
import { v4 as uuidv4 } from 'uuid'
import type { VideoInspection, InspectionReport, YakujiSettings } from '@/types'

const YAKUJI_PATH = path.join(process.cwd(), 'data', 'rules', 'yakuji.json')

function readYakuji(): YakujiSettings | null {
  if (!existsSync(YAKUJI_PATH)) return null
  try {
    return JSON.parse(readFileSync(YAKUJI_PATH, 'utf-8')) as YakujiSettings
  } catch {
    return null
  }
}

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
    const originalDims = (video.originalWidth && video.originalHeight)
      ? { width: video.originalWidth, height: video.originalHeight, fps: video.originalFps }
      : null
    const visionInterval: number = (db.data.settings as Record<string, unknown> | undefined)?.visionFrameInterval as number
      ?? parseInt(process.env.VISION_FRAME_INTERVAL || '3')

    // 通常ルールによる検品
    const results = await inspectVideo(feature, rules, originalDims, visionInterval)

    // 薬機法チェック（有効時のみ）
    const yakuji = readYakuji()
    if (yakuji?.enabled) {
      const yakujiResults = await inspectYakuji(feature, yakuji)
      results.push(...yakujiResults)
      inspection.yakujiReference = {
        sourceName: yakuji.source_name ?? '医薬品等適正広告基準',
        sourceUpdatedAt: yakuji.source_updated_at ?? undefined,
      }
    }

    inspection.results = results
    inspection.status = 'completed'
    inspection.completedAt = new Date().toISOString()

    const nonYakujiIssues = results.filter(
      r => r.category !== '薬機法' && (r.judgment === 'NG' || r.judgment === '要確認')
    )
    const report: InspectionReport = {
      id: uuidv4(),
      inspectionId: inspection.id,
      videoId,
      issues: nonYakujiIssues.map(i => ({
        ruleContent: i.ruleContent,
        judgment: i.judgment,
        reason: i.reason,
      })),
      suggestions: nonYakujiIssues.map(i => i.reason),
      comments: `検査完了。${results.length}件のルールを確認しました。${nonYakujiIssues.length}件の問題が見つかりました。`,
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
