/**
 * セッションログ機能
 *
 * [xxxx] で始まるアプリケーションログのみをファイルに書き出す。
 * HTTP リクエストログ（GET /api/... など）は除外。
 * セッションごとに新しいファイルを生成し、30日後に自動削除。
 */
import { appendFile, mkdir, readdir, stat, unlink } from 'fs/promises'
import path from 'path'

const LOGS_DIR = path.join(process.cwd(), 'data', 'logs')
const RETENTION_DAYS = 30

// [ffprobe] [ffmpeg] [Tesseract] [Whisper] [yt-dlp] [compress] [pipeline] [AI] [db] [logger] etc.
const APP_LOG_RE = /^\[[\w\-\/\.]+\]/

let logFilePath: string | null = null

function hhmm(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

async function write(line: string): Promise<void> {
  if (!logFilePath) return
  try {
    await appendFile(logFilePath, line + '\n', 'utf8')
  } catch {
    // ファイル書き込み失敗は無視（ロガー自体がクラッシュしないように）
  }
}

async function cleanOldLogs(): Promise<void> {
  try {
    const files = await readdir(LOGS_DIR)
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    for (const file of files) {
      if (!file.startsWith('session-') || !file.endsWith('.log')) continue
      const fp = path.join(LOGS_DIR, file)
      const s = await stat(fp).catch(() => null)
      if (s && s.mtimeMs < cutoff) {
        await unlink(fp)
        console.log(`[logger] 古いログを削除: ${file}`)
      }
    }
  } catch {
    // cleanup 失敗は無視
  }
}

export async function initLogger(): Promise<void> {
  // hot-reload でモジュールが再読み込みされても二重パッチを防ぐ
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((console as any).__loggerPatched) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(console as any).__loggerPatched = true

  await mkdir(LOGS_DIR, { recursive: true })
  await cleanOldLogs()

  const now = new Date()
  const ts = now.toISOString().slice(0, 19).replace('T', '-').replace(/:/g, '-')
  logFilePath = path.join(LOGS_DIR, `session-${ts}.log`)

  const header = [
    `=== セッション開始: ${now.toLocaleString('ja-JP')} ===`,
    '',
  ].join('\n')
  await appendFile(logFilePath, header + '\n', 'utf8')

  // console.log / console.error をラップして [xxx] で始まる行のみファイルに書き出す
  const origLog = console.log.bind(console)
  const origError = console.error.bind(console)

  console.log = (...args: unknown[]) => {
    origLog(...args)
    const msg = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ')
    if (APP_LOG_RE.test(msg)) write(`${hhmm()} ${msg}`).catch(() => {})
  }

  console.error = (...args: unknown[]) => {
    origError(...args)
    const msg = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ')
    if (APP_LOG_RE.test(msg)) write(`${hhmm()} ${msg}`).catch(() => {})
  }

  console.log(`[logger] セッションログ: data/logs/${path.basename(logFilePath)}`)
}
