import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

function checkBinary(cmd: string): boolean {
  try { execSync(cmd, { stdio: 'ignore', timeout: 3000 }); return true } catch { return false }
}

export async function GET() {
  const ffmpeg = checkBinary('ffmpeg -version')
  const ffprobe = checkBinary('ffprobe -version')
  const ytdlp = checkBinary('yt-dlp --version')

  const ok = ffmpeg && ffprobe

  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: { ffmpeg, ffprobe, ytdlp },
      r2: !!(process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET),
      snsDownload: process.env.ENABLE_SNS_DOWNLOAD === 'true',
    },
    { status: ok ? 200 : 503 }
  )
}
