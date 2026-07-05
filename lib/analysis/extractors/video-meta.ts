import ffmpeg from 'fluent-ffmpeg'
import type { VideoMeta } from '../types'

const FFPROBE_TIMEOUT_MS = 30_000  // 30秒でタイムアウト

function parseFps(str: string | undefined): number {
  if (!str) return 0
  const parts = str.split('/')
  if (parts.length === 2) {
    const num = parseFloat(parts[0])
    const den = parseFloat(parts[1])
    return den > 0 ? Math.round((num / den) * 100) / 100 : 0
  }
  return parseFloat(str) || 0
}

const SNS_DOMAINS = [
  'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
  'facebook.com', 'youtube.com', 'youtu.be', 'linkedin.com',
]

function toUserFriendlyError(source: string, rawMessage: string): string {
  const msg = rawMessage.toLowerCase()

  if (msg.includes('timed out') || msg.includes('timeout')) {
    return `動画情報の取得がタイムアウトしました（${FFPROBE_TIMEOUT_MS / 1000}秒）。URLへのアクセスが遅すぎるか、応答がありません。`
  }

  const matchedSns = SNS_DOMAINS.find(d => source.includes(d))
  if (matchedSns) {
    return `${matchedSns} のURLは直接解析できません。SNSの動画はお手本動画の登録画面から「SNSのURLから取得」を使用してください。`
  }

  if (msg.includes('no such file') || msg.includes('not found')) {
    return 'ファイルが見つかりません。パスまたはURLを確認してください。'
  }

  if (msg.includes('connection') || msg.includes('network') || msg.includes('refused')) {
    return 'URLにアクセスできませんでした。ネットワーク接続とURLを確認してください。'
  }

  if (msg.includes('403') || msg.includes('forbidden') || msg.includes('401')) {
    return 'URLへのアクセスが拒否されました。公開された動画ファイルのURLを使用してください。'
  }

  if (msg.includes('invalid data') || msg.includes('format not supported') || msg.includes('no streams')) {
    return '動画ファイルとして読み込めませんでした。URLが .mp4 / .mov などの動画ファイルを直接指しているか確認してください。'
  }

  return '動画情報の取得に失敗しました。URLまたはファイルパスを確認してください。'
}

export async function extractVideoMeta(source: string): Promise<VideoMeta> {
  const label = source.length > 80 ? source.slice(0, 80) + '…' : source
  console.log(`[ffprobe] 開始: ${label}`)

  return new Promise((resolve, reject) => {
    // タイムアウト: 指定秒数内に応答がなければエラー
    const timer = setTimeout(() => {
      const msg = `動画情報の取得がタイムアウトしました（${FFPROBE_TIMEOUT_MS / 1000}秒）。URLへのアクセスが遅すぎるか、応答がありません。`
      console.error(`[ffprobe] タイムアウト: ${label}`)
      reject(new Error(msg))
    }, FFPROBE_TIMEOUT_MS)

    ffmpeg.ffprobe(source, (err, data) => {
      clearTimeout(timer)

      if (err) {
        console.error(`[ffprobe] エラー: ${err.message}`)
        reject(new Error(toUserFriendlyError(source, err.message)))
        return
      }

      const video = data.streams.find(s => s.codec_type === 'video')
      const audio = data.streams.find(s => s.codec_type === 'audio')
      const fmt = data.format
      const duration = Math.round(Number(fmt.duration) || 0)

      console.log(`[ffprobe] 完了: ${duration}秒 ${video?.width ?? 0}×${video?.height ?? 0} ${video?.codec_name ?? '不明'} 音声=${!!audio}`)

      resolve({
        duration,
        width: video?.width || 0,
        height: video?.height || 0,
        fps: parseFps(video?.r_frame_rate),
        bitrate: Math.round(Number(fmt.bit_rate || 0) / 1000),
        videoCodec: video?.codec_name || '',
        audioCodec: audio?.codec_name,
        hasAudio: !!audio,
        fileSize: Number(fmt.size || 0),
      })
    })
  })
}
