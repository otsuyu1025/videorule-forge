import ffmpeg from 'fluent-ffmpeg'
import { rename, rm, stat } from 'fs/promises'
import path from 'path'

/**
 * 動画をOCR用解像度に圧縮して元ファイルと置き換える。
 * - 高さ VIDEO_OCR_MAX_HEIGHT px 以下にスケールダウン（アップスケールなし）
 * - H.264 / AAC に統一（MP4コンテナ）
 * - 元の解像度が既に小さい場合はスキップ
 *
 * @returns 保存後のファイルパス（拡張子が .mp4 に変わることがある）
 */
export async function compressVideoForOcr(videoPath: string): Promise<string> {
  const maxHeight = parseInt(process.env.VIDEO_OCR_MAX_HEIGHT || '720')
  const dir = path.dirname(videoPath)
  const base = path.basename(videoPath, path.extname(videoPath))
  const outputPath = path.join(dir, `${base}.mp4`)
  const tempPath = path.join(dir, `${base}_tmp.mp4`)

  // 元ファイルのサイズ確認（圧縮後と比較用）
  const beforeSize = await stat(videoPath).then(s => s.size).catch(() => 0)

  console.log(`[compress] 動画を圧縮中: ${path.basename(videoPath)} → 最大高さ ${maxHeight}px`)

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(videoPath)
        // 高さが maxHeight を超える場合のみ縮小（アップスケールなし）
        .videoFilters(`scale=-2:min(${maxHeight}\\,ih)`)
        .outputOptions([
          '-c:v', 'libx264',
          '-crf', '28',          // 品質（低いほど高品質・大容量。28はOCR用途に適切）
          '-preset', 'fast',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-movflags', '+faststart',  // Web再生最適化
          '-y',
        ])
        .output(tempPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run()
    })

    const afterSize = await stat(tempPath).then(s => s.size).catch(() => 0)
    const ratio = beforeSize > 0 ? Math.round((afterSize / beforeSize) * 100) : 0
    console.log(
      `[compress] 圧縮完了: ${Math.round(beforeSize / 1024)}KB → ${Math.round(afterSize / 1024)}KB (${ratio}%)`
    )

    // 元ファイルを削除して圧縮済みファイルに置き換え
    if (videoPath !== outputPath) {
      await rm(videoPath, { force: true })
    }
    await rename(tempPath, outputPath)

    return outputPath
  } catch (err) {
    // 圧縮失敗時は元ファイルをそのまま使用（エラーは握り潰さずログに残す）
    await rm(tempPath, { force: true })
    console.error(`[compress] 圧縮に失敗しました。元ファイルを使用します: ${err instanceof Error ? err.message : err}`)
    return videoPath
  }
}
