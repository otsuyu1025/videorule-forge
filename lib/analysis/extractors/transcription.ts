import ffmpeg from 'fluent-ffmpeg'
import { mkdir, readFile, rm } from 'fs/promises'
import path from 'path'
import type { TranscriptChunk } from '@/types'

// return_timestamps: true を使うため、戻り値の型を拡張する
type Transcriber = (
  input: Float32Array,
  options: {
    sampling_rate: number
    language?: string
    task?: string
    return_timestamps?: boolean
  }
) => Promise<{
  text: string
  chunks?: Array<{ timestamp: [number | null, number | null]; text: string }>
}>

// 環境変数によるデフォルト無効フラグ（設定画面からも上書き可能）
const TRANSCRIPTION_DISABLED_ENV = process.env.DISABLE_TRANSCRIPTION === 'true'

// WHISPER_MODEL で使用するモデルを切り替え可能
// whisper-tiny: ~39MB, whisper-small: ~244MB (デフォルト)
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'Xenova/whisper-small'

let _transcriber: Transcriber | null = null
let _transcriberUnavailable = false

async function getTranscriber(disabled?: boolean): Promise<Transcriber | null> {
  // DISABLE_TRANSCRIPTION=true は設定画面の値より優先（低メモリ環境での保護）
  if (TRANSCRIPTION_DISABLED_ENV) {
    console.log('[Whisper] DISABLE_TRANSCRIPTION=true のためスキップします')
    return null
  }
  // DB 未設定（undefined）の場合もデフォルトで無効
  if (disabled !== false) {
    console.log('[Whisper] 音声文字起こしが無効のためスキップします')
    return null
  }
  if (_transcriberUnavailable) return null
  if (_transcriber) return _transcriber

  console.log(`[Whisper] モデルをロード中: ${WHISPER_MODEL} (初回は最大244MBのダウンロードが発生します)`)

  try {
    const { pipeline } = await import('@xenova/transformers')

    _transcriber = await pipeline(
      'automatic-speech-recognition',
      WHISPER_MODEL,
      { quantized: true },
    ) as unknown as Transcriber

    console.log('[Whisper] モデルのロード完了')
    return _transcriber
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)

    if (msg.includes('certificate') || msg.includes('fetch failed') || msg.includes('unable to get')) {
      _transcriberUnavailable = true
      console.error('[Whisper] SSLエラーのためモデルダウンロードに失敗しました。音声文字起こしをスキップします。')
      console.error('[Whisper] 修正方法: npm run dev:log で起動してください（NODE_TLS_REJECT_UNAUTHORIZED=0 が適用されます）')
      return null
    }

    if (msg.includes('sharp') || msg.includes('Cannot find module')) {
      _transcriberUnavailable = true
      console.error('[Whisper] sharp モジュールが未インストールのため、音声文字起こしをスキップします。')
      console.error('[Whisper] 修正方法: NODE_TLS_REJECT_UNAUTHORIZED=0 npm install sharp')
      return null
    }

    // その他のエラー（ネットワーク、メモリ不足など）も音声文字起こしをスキップ
    _transcriberUnavailable = true
    console.error('[Whisper] モデルのロードに失敗しました。音声文字起こしをスキップします:', msg)
    return null
  }
}

/**
 * WAVファイルを読み込んで Float32Array に変換する。
 * Node.js には AudioContext がないため、PCMデータを直接パースする。
 * ffmpeg が生成する 16kHz / mono / 16bit PCM WAV を前提とする。
 */
async function loadWavAsFloat32(wavPath: string): Promise<Float32Array> {
  const buf = await readFile(wavPath)

  let dataOffset = 44
  let dataSize = buf.length - 44

  if (buf.toString('ascii', 0, 4) === 'RIFF') {
    let offset = 12
    while (offset < buf.length - 8) {
      const chunkId = buf.toString('ascii', offset, offset + 4)
      const chunkSize = buf.readUInt32LE(offset + 4)
      if (chunkId === 'data') {
        dataOffset = offset + 8
        dataSize = Math.min(chunkSize, buf.length - dataOffset)
        break
      }
      offset += 8 + chunkSize
    }
  }

  const samples = Math.floor(dataSize / 2)
  const pcm = new Int16Array(buf.buffer, buf.byteOffset + dataOffset, samples)
  const float32 = new Float32Array(samples)
  for (let i = 0; i < samples; i++) {
    float32[i] = pcm[i] / 32768.0
  }
  return float32
}

export interface TranscribeResult {
  text: string
  chunks: TranscriptChunk[]
}

export async function transcribeAudio(
  source: string,
  videoId: string,
  disabled?: boolean,
): Promise<TranscribeResult> {
  const transcriber = await getTranscriber(disabled)
  if (!transcriber) return { text: '', chunks: [] }

  const audioDir = path.join(process.cwd(), 'data', 'uploads', 'audio')
  await mkdir(audioDir, { recursive: true })
  const audioPath = path.join(audioDir, `${videoId}.wav`)

  console.log(`[Whisper] 音声文字起こし開始: ${source.slice(0, 60)}`)

  await new Promise<void>((resolve, reject) => {
    ffmpeg(source)
      .outputOptions(['-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le'])
      .output(audioPath)
      .on('end', () => resolve())
      .on('error', (err: Error) =>
        reject(new Error(`音声抽出に失敗しました: ${err.message}`))
      )
      .run()
  })

  try {
    const audioData = await loadWavAsFloat32(audioPath)
    const result = await transcriber(audioData, {
      sampling_rate: 16000,
      language: 'japanese',
      task: 'transcribe',
      return_timestamps: true,  // タイムスタンプ付きセグメントを要求
    })

    const text = result.text?.trim() ?? ''

    // chunks をタイムスタンプ付きセグメントに変換
    const chunks: TranscriptChunk[] = (result.chunks ?? [])
      .filter(c => c.timestamp[0] !== null && c.text.trim().length > 0)
      .map(c => ({
        start: Math.round((c.timestamp[0] as number) * 10) / 10,  // 小数第1位まで
        end: Math.round(((c.timestamp[1] ?? c.timestamp[0]) as number) * 10) / 10,
        text: c.text.trim(),
      }))

    console.log(`[Whisper] 文字起こし完了: ${text.length}文字 / ${chunks.length}セグメント`)
    return { text, chunks }
  } finally {
    await rm(audioPath, { force: true })
  }
}
