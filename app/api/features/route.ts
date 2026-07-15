import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

// 機能フラグ: 環境変数で制御。デフォルトはすべて無効。
export async function GET() {
  const db = await getDb()
  const settings = (db.data.settings ?? {}) as Record<string, unknown>
  const visionFrameInterval: number = settings.visionFrameInterval as number
    ?? parseInt(process.env.VISION_FRAME_INTERVAL || '3')

  const transcriptionDisabled: boolean = settings.transcriptionDisabled as boolean
    ?? process.env.DISABLE_TRANSCRIPTION === 'true'

  return NextResponse.json({
    snsDownload: process.env.ENABLE_SNS_DOWNLOAD === 'true',
    transcriptionDisabled,
    frameIntervalSeconds: parseInt(process.env.VIDEO_FRAME_INTERVAL || '1'),
    visionFrameInterval,
  })
}
