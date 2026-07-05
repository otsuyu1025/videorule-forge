import { createWorker } from 'tesseract.js'
import path from 'path'
import { existsSync } from 'fs'
import type { FrameData } from '../types'

// ローカルの言語データを優先使用（CDNダウンロードのSSL問題を回避）
const LOCAL_LANG_PATH = path.join(process.cwd(), 'data', 'tessdata')
const hasLocalData = existsSync(path.join(LOCAL_LANG_PATH, 'jpn.traineddata'))

export async function runOcr(
  frames: Array<{ path: string; timestamp: number }>
): Promise<FrameData[]> {
  if (frames.length === 0) return []

  console.log(
    `[Tesseract] OCR開始: ${frames.length}枚のフレームを処理` +
    (hasLocalData ? '（ローカル言語データ使用）' : '（CDNから言語データ取得）')
  )

  const workerOptions = hasLocalData
    ? { langPath: LOCAL_LANG_PATH, logger: () => {} }
    : { logger: () => {} }

  const worker = await createWorker(['jpn', 'eng'], 1, workerOptions)

  // 精度向上のための Tesseract パラメータ設定
  // oem=1: LSTM のみ（Legacy 混合より精度が高い）
  // psm=6: 単一テキストブロックとして認識（動画テロップ向き）
  // psm=11: 疎テキストモード（文字が散在する場合に有効）
  // ※ 画面に文字が密集している場合は psm=6、まばらな場合は psm=11 が向く
  // psm=6: 単一テキストブロックとして認識（動画テロップ向き）
  // PSM 型の定数を使う（数値リテラルで渡すと型エラーになる）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (worker as any).setParameters({
    tessedit_pageseg_mode: '6',    // PSM_SINGLE_BLOCK
  })

  const results: FrameData[] = []

  for (const frame of frames) {
    try {
      const { data } = await worker.recognize(frame.path)
      // 余分な空白・改行を圧縮
      const text = data.text
        .trim()
        .replace(/\s+/g, ' ')
        // 信頼度の低い文字（文字化け）を除去
        .replace(/[^ -~　-鿿＀-￯゠-ヿ぀-ゟ]/g, '')
        .trim()
      results.push({ timestamp: frame.timestamp, imagePath: frame.path, ocrText: text })
    } catch {
      results.push({ timestamp: frame.timestamp, imagePath: frame.path, ocrText: '' })
    }
  }

  await worker.terminate()
  const detected = results.filter(r => r.ocrText.length > 0).length
  console.log(`[Tesseract] OCR完了: ${detected}/${frames.length}枚でテキスト検出`)
  return results
}
