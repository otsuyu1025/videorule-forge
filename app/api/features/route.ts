import { NextResponse } from 'next/server'

// 機能フラグ: 環境変数で制御。デフォルトはすべて無効。
export async function GET() {
  return NextResponse.json({
    snsDownload: process.env.ENABLE_SNS_DOWNLOAD === 'true',
    transcriptionDisabled: process.env.DISABLE_TRANSCRIPTION === 'true',
  })
}
