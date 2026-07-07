import ffmpeg from 'fluent-ffmpeg'
import { mkdir, readdir, rename } from 'fs/promises'
import path from 'path'
import type { AnalysisConfig } from '../types'
import { uploadFramesToR2 } from '@/lib/storage/r2'

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

  // ffmpeg が出力した連番ファイル（frame-0001.jpg 〜）をタイムスタンプ入り名にリネーム
  // 例: frame-0001.jpg → frame-0s.jpg, frame-0002.jpg → frame-1s.jpg (interval=1)
  //     frame-0001.jpg → frame-0s.jpg, frame-0002.jpg → frame-2s.jpg (interval=2)
  const rawFiles = (await readdir(framesDir))
    .filter(f => /^frame-\d{4}\.jpg$/.test(f))
    .sort()

  console.log(`[ffmpeg] フレーム抽出完了: ${rawFiles.length}枚`)

  const result: Array<{ path: string; timestamp: number }> = []
  for (let i = 0; i < rawFiles.length; i++) {
    const timestamp = i * config.frameInterval
    const ts = Number.isInteger(timestamp) ? String(timestamp) : timestamp.toFixed(1)
    const newFilename = `frame-${ts}s.jpg`
    const oldPath = path.join(framesDir, rawFiles[i])
    const newPath = path.join(framesDir, newFilename)
    await rename(oldPath, newPath)
    result.push({ path: newPath, timestamp })
  }

  // R2が設定されている場合はアップロード（ローカル開発では無視）
  await uploadFramesToR2(videoId, result).catch(err =>
    console.error(`[r2] アップロード失敗 (続行): ${err.message}`)
  )

  return result
}
