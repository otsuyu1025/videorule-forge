import ffmpeg from 'fluent-ffmpeg'
import { existsSync } from 'fs'
import { readdir } from 'fs/promises'
import path from 'path'
import { extractVideoMeta } from './extractors/video-meta'
import { extractFrames } from './extractors/frames'
import { runOcr } from './extractors/ocr'
import { transcribeAudio } from './extractors/transcription'
import type { ExtractedFeatures, AnalysisConfig } from './types'
import type { VideoStatus } from '@/types'

// システムにインストール済みのffmpegを利用
ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH || 'ffmpeg')
ffmpeg.setFfprobePath(process.env.FFPROBE_PATH || 'ffprobe')

function getConfig(): AnalysisConfig {
  return {
    frameInterval: parseInt(process.env.VIDEO_FRAME_INTERVAL || '1'),
    maxFrames: parseInt(process.env.VIDEO_FRAME_MAX || '30'),
  }
}

/**
 * 既存フレームを探す。
 * `data/frames/{videoId}/` に jpg が残っていれば再利用してffmpegをスキップできる。
 */
async function findExistingFrames(
  videoId: string,
  config: AnalysisConfig,
): Promise<Array<{ path: string; timestamp: number }> | null> {
  const framesDir = path.join(process.cwd(), 'data', 'frames', videoId)
  if (!existsSync(framesDir)) return null

  const files = (await readdir(framesDir)).filter(f => f.endsWith('.jpg')).sort()
  if (files.length === 0) return null

  console.log(`[ffmpeg] 既存フレームを再利用: ${files.length}枚（ffmpegをスキップ）`)
  return files.map((filename, index) => {
    // 新形式: frame-3s.jpg → timestamp = 3
    const match = filename.match(/^frame-(\d+(?:\.\d+)?)s\.jpg$/)
    const timestamp = match ? parseFloat(match[1]) : index * config.frameInterval
    return { path: path.join(framesDir, filename), timestamp }
  })
}

/**
 * 動画解析パイプライン
 *
 * Stage 1（AI不使用）:
 *   1. ffprobe でメタデータ取得
 *   2. ffmpeg でフレーム抽出（既存フレームがあれば再利用）
 *   3. Tesseract で各フレームのOCR
 *   4. Whisper で音声文字起こし
 *
 * 各ステージ開始前に onStatusUpdate を呼び出す。
 * URLがアクセス不能な場合は Stage 1a でエラーをスローする。
 */
export async function analyzeVideo(
  source: string,
  videoId: string,
  onStatusUpdate?: (status: VideoStatus) => Promise<void>,
): Promise<ExtractedFeatures> {
  const config = getConfig()

  // Stage 1a: メタデータ取得
  await onStatusUpdate?.('extracting_meta')
  const meta = await extractVideoMeta(source)

  // Stage 1b: フレーム抽出（前回の残骸があれば再利用）
  await onStatusUpdate?.('extracting_frames')
  const existingFrames = await findExistingFrames(videoId, config)
  const framePaths = existingFrames ?? await extractFrames(source, videoId, config)

  // Stage 1c: OCR
  await onStatusUpdate?.('running_ocr')
  const frames = await runOcr(framePaths)

  // Stage 1d: 音声文字起こし（音声トラックがない場合はスキップ）
  let transcription = ''
  let transcriptChunks: import('@/types').TranscriptChunk[] = []
  if (meta.hasAudio) {
    await onStatusUpdate?.('transcribing')
    const result = await transcribeAudio(source, videoId)
    transcription = result.text
    transcriptChunks = result.chunks
  }

  const ocrTexts = [
    ...new Set(frames.map(f => f.ocrText).filter(t => t.length > 0)),
  ]

  return {
    meta,
    frames,
    ocrTexts,
    transcription,
    transcriptChunks,
    extractedAt: new Date().toISOString(),
  }
}
