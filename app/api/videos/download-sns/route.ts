import { NextRequest } from 'next/server'
import { getDb, resetDbInstance } from '@/lib/db'
import { compressVideoForOcr } from '@/lib/analysis/extractors/compress-video'
import { v4 as uuidv4 } from 'uuid'
import { mkdir, readdir } from 'fs/promises'
import { execSync, spawn } from 'child_process'
import path from 'path'
import type { Video } from '@/types'

const YT_DLP_PATHS = [
  '/opt/homebrew/bin/yt-dlp',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
]

function findYtDlp(): string | null {
  if (process.env.YT_DLP_PATH) return process.env.YT_DLP_PATH
  for (const p of YT_DLP_PATHS) {
    try { execSync(`test -x "${p}"`, { stdio: 'ignore' }); return p } catch { /* next */ }
  }
  try { return execSync('which yt-dlp', { encoding: 'utf8' }).trim() } catch { return null }
}

/** yt-dlp を非同期（ノンブロッキング）で実行する */
function spawnAsync(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(stderr.trim() || `yt-dlp がエラーで終了しました（code ${code}）`))
    })
    proc.on('error', reject)
  })
}

function toUserFriendlyError(stderr: string, url: string, cookieBrowser?: string): string {
  const s = stderr.toLowerCase()
  if (s.includes('private') || s.includes('login') || s.includes('sign in')) {
    return 'この動画は非公開または要ログインのため取得できません。公開されている動画のURLを入力してください。'
  }
  if (s.includes('not available') || s.includes('removed') || s.includes('deleted')) {
    return 'この動画は削除または非公開になっています。'
  }
  if (s.includes('rate') || s.includes('too many')) {
    return 'リクエストが多すぎます。時間をおいてからもう一度お試しください。'
  }
  if (s.includes('unsupported url') || s.includes('no suitable')) {
    return `このURLには対応していません。Instagram・TikTok・YouTube・Twitter/X などのSNS動画URLを入力してください。`
  }
  if (url.includes('instagram.com') && !cookieBrowser) {
    return 'Instagramの動画取得にはブラウザの設定が必要です。設定画面でInstagramにログイン済みのブラウザを選択してください。'
  }
  return `ダウンロードに失敗しました。URLが正しいか、動画が公開されているか確認してください。`
}

export async function POST(request: NextRequest) {
  if (process.env.ENABLE_SNS_DOWNLOAD !== 'true') {
    return Response.json({ error: 'SNS動画取得機能は現在無効です。管理者にお問い合わせください。' }, { status: 403 })
  }

  const { snsUrl, customTitle } = await request.json()

  if (!snsUrl || typeof snsUrl !== 'string') {
    return Response.json({ error: 'URLを入力してください' }, { status: 400 })
  }

  const ytDlpPath = findYtDlp()
  if (!ytDlpPath) {
    return Response.json({
      error: 'yt-dlp がインストールされていません。ターミナルで pip3 install yt-dlp を実行してください。',
    }, { status: 500 })
  }

  const db = await getDb()
  const cookieBrowser = (db.data.settings ?? {}).snsBrowser
  const cookieArgs: string[] = cookieBrowser ? ['--cookies-from-browser', cookieBrowser] : []

  const videoId = uuidv4()
  const downloadsDir = path.join(process.cwd(), 'data', 'uploads', 'videos')
  await mkdir(downloadsDir, { recursive: true })
  const outputTemplate = path.join(downloadsDir, `${videoId}.%(ext)s`)

  // Step 1: 動画レコードをすぐ作成して返す（ダウンロードはバックグラウンドで実行）
  const video: Video = {
    id: videoId,
    title: customTitle || 'SNS動画（取得中）',
    type: 'sample',
    url: snsUrl,
    status: 'downloading',
    createdAt: new Date().toISOString(),
  }
  db.data.videos.push(video)
  await db.write()

  // Step 2: yt-dlp をバックグラウンドで非同期実行（イベントループをブロックしない）
  ;(async () => {
    try {
      console.log(`[yt-dlp] ダウンロード開始: ${snsUrl}`)

      // タイトルをSNSから取得（カスタムタイトル未指定の場合）
      if (!customTitle) {
        try {
          const fetched = await spawnAsync(ytDlpPath, [
            ...cookieArgs, '--no-warnings', '--print', '%(title)s', '--no-playlist', snsUrl,
          ])
          const t = fetched.split('\n')[0].trim()
          if (t) {
            const v = db.data.videos.find(v => v.id === videoId)
            if (v) { v.title = t; await db.write() }
          }
        } catch {
          // タイトル取得失敗は無視してダウンロードを続行
        }
      }

      // 動画をダウンロード
      await spawnAsync(ytDlpPath, [
        ...cookieArgs,
        '-o', outputTemplate,
        '-f', 'best[ext=mp4]/mp4/best',
        '--no-playlist', '--no-warnings', snsUrl,
      ])

      // ダウンロードされたファイルを特定（拡張子が可変なのでIDで検索）
      const files = await readdir(downloadsDir)
      const downloaded = files.find(f => f.startsWith(videoId))
      const v = db.data.videos.find(v => v.id === videoId)

      if (v) {
        if (downloaded) {
          const rawFilePath = path.join(downloadsDir, downloaded)

          // ダウンロード後に解像度を圧縮（OCR読み取り可能レベルまで下げる）
          const compressedFilePath = await compressVideoForOcr(rawFilePath)

          v.filePath = compressedFilePath
          v.status = 'pending'
          console.log(`[yt-dlp] ダウンロード完了: ${downloaded}`)

          // 古いdbインスタンスに書き込み
          await db.write()
          console.log(`[yt-dlp] DB更新完了: status=pending`)

          // ホットリロードで新しいインスタンスが作られていた場合に同期する
          resetDbInstance()
          const freshDb = await getDb()
          const freshVideo = freshDb.data.videos.find(vv => vv.id === videoId)
          if (freshVideo && freshVideo.status === 'downloading') {
            freshVideo.status = 'pending'
            freshVideo.filePath = v.filePath
            await freshDb.write()
            console.log(`[yt-dlp] DBシングルトン同期完了 → 次のポーリングでUIが更新されます`)
          } else {
            console.log(`[yt-dlp] DBシングルトン確認済み status=${freshVideo?.status}`)
          }
        } else {
          v.status = 'error'
          v.errorMessage = 'ダウンロードは完了しましたがファイルが見つかりません。'
          await db.write()
          console.error(`[yt-dlp] エラー: ファイルが見つかりません`)
        }
      }
    } catch (error) {
      const stderr = error instanceof Error ? error.message : String(error)
      const v = db.data.videos.find(v => v.id === videoId)
      if (v) {
        v.status = 'error'
        v.errorMessage = toUserFriendlyError(stderr, snsUrl, cookieBrowser)
        await db.write()
      }
      console.error(`[yt-dlp] エラー: ${stderr}`)
    }
  })()

  // yt-dlp の完了を待たずにすぐ返す
  return Response.json(video, { status: 201 })
}
