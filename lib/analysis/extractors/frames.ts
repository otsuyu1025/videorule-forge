import ffmpeg from 'fluent-ffmpeg'
import { mkdir, readdir } from 'fs/promises'
import path from 'path'
import type { AnalysisConfig } from '../types'

export async function extractFrames(
  source: string,
  videoId: string,
  config: AnalysisConfig,
): Promise<Array<{ path: string; timestamp: number }>> {
  const framesDir = path.join(process.cwd(), 'data', 'frames', videoId)
  await mkdir(framesDir, { recursive: true })

  // OCR用の最大高さ（デフォルト720px）
  // 元動画がこれより小さい場合はそのまま（アップスケールしない）
  const maxHeight = parseInt(process.env.VIDEO_OCR_MAX_HEIGHT || '720')

  console.log(
    `[ffmpeg] フレーム抽出開始: ${config.frameInterval}秒ごと, ` +
    `最大${config.maxFrames}枚, OCR解像度 高さ${maxHeight}px以下`
  )

  // fps=1/N で「N秒ごとに1フレーム」。
  // scale=-2:MAX_HEIGHT で高さをMAX_HEIGHT以下に縮小（アスペクト比維持）。
  // アップスケール防止のため min(MAX_HEIGHT, ih) を使用。
  const scaleFilter = `scale=-2:min(${maxHeight}\\,ih)`

  await new Promise<void>((resolve, reject) => {
    ffmpeg(source)
      .videoFilters([
        `fps=1/${config.frameInterval}`,
        scaleFilter,
      ])
      .outputOptions([
        '-frames:v', String(config.maxFrames),
        '-q:v', '3',   // JPEG品質（1=最高, 31=最低）
      ])
      .output(path.join(framesDir, 'frame-%04d.jpg'))
      .on('end', () => resolve())
      .on('error', (err: Error) =>
        reject(new Error(`フレーム抽出に失敗しました: ${err.message}`))
      )
      .run()
  })

  const files = (await readdir(framesDir))
    .filter(f => f.endsWith('.jpg'))
    .sort()

  console.log(`[ffmpeg] フレーム抽出完了: ${files.length}枚`)

  return files.map((filename, index) => ({
    path: path.join(framesDir, filename),
    timestamp: index * config.frameInterval,
  }))
}
