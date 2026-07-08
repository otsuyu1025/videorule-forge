import { createWorker } from 'tesseract.js'
import { createGunzip } from 'zlib'
import { createWriteStream } from 'fs'
import { mkdir } from 'fs/promises'
import { pipeline as streamPipeline } from 'stream/promises'
import { Readable } from 'stream'
import path from 'path'
import { existsSync } from 'fs'
import type { FrameData } from '../types'

const LOCAL_LANG_PATH = path.join(process.cwd(), 'data', 'tessdata')
const TESSDATA_CDN = 'https://tessdata.projectnaptha.com/4.0.0'

// Railway Volume にキャッシュする。存在すれば即リターン、なければ CDN からダウンロード。
async function ensureTessdata(): Promise<void> {
  const langs = ['jpn', 'eng']
  const missing = langs.filter(l => !existsSync(path.join(LOCAL_LANG_PATH, `${l}.traineddata`)))
  if (missing.length === 0) return

  await mkdir(LOCAL_LANG_PATH, { recursive: true })
  for (const lang of missing) {
    const dest = path.join(LOCAL_LANG_PATH, `${lang}.traineddata`)
    console.log(`[Tesseract] ${lang}.traineddata をダウンロード中 → ${dest}`)
    const res = await fetch(`${TESSDATA_CDN}/${lang}.traineddata.gz`)
    if (!res.ok) throw new Error(`tessdata download failed: ${res.status}`)
    await streamPipeline(
      Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
      createGunzip(),
      createWriteStream(dest),
    )
    console.log(`[Tesseract] ${lang}.traineddata 保存完了（以降は Volume キャッシュを使用）`)
  }
}

export async function runOcr(
  frames: Array<{ path: string; timestamp: number }>,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<FrameData[]> {
  if (frames.length === 0) return []

  await ensureTessdata()

  console.log(`[Tesseract] OCR開始: ${frames.length}枚のフレームを処理（ローカル言語データ使用）`)

  const worker = await createWorker(['jpn', 'eng'], 1, {
    langPath: LOCAL_LANG_PATH,
    logger: () => {},
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (worker as any).setParameters({ tessedit_pageseg_mode: '6' })

  const results: FrameData[] = []
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i]
    try {
      const { data } = await worker.recognize(frame.path)
      const text = data.text
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^ -~　-鿿＀-￯゠-ヿ぀-ゟ]/g, '')
        .trim()
      results.push({ timestamp: frame.timestamp, imagePath: frame.path, ocrText: text })
    } catch {
      results.push({ timestamp: frame.timestamp, imagePath: frame.path, ocrText: '' })
    }
    await onProgress?.(i + 1, frames.length)
  }

  await worker.terminate()
  const detected = results.filter(r => r.ocrText.length > 0).length
  console.log(`[Tesseract] OCR完了: ${detected}/${frames.length}枚でテキスト検出`)
  return results
}
