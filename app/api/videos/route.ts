import { NextRequest } from 'next/server'
import { mkdir } from 'fs/promises'
import { createWriteStream } from 'fs'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import path from 'path'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { compressVideoForOcr, getOriginalDimensions } from '@/lib/analysis/extractors/compress-video'
import type { Video } from '@/types'

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_VIDEO_SIZE_MB || '200')
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024

export async function GET(request: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')

  let videos = db.data.videos.filter(v => !v.deletedAt)
  if (type) videos = videos.filter(v => v.type === type)
  videos = videos.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return Response.json(videos)
}

export async function POST(request: NextRequest) {
  const db = await getDb()
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const titleField = formData.get('title') as string | null
    const typeField = (formData.get('type') as string | null) ?? 'inspection'

    if (!file) return Response.json({ error: 'ファイルが選択されていません' }, { status: 400 })

    if (file.size > MAX_FILE_SIZE) {
      return Response.json({
        error: `ファイルサイズが大きすぎます（${Math.round(file.size / 1024 / 1024)}MB）。上限は${MAX_FILE_SIZE_MB}MBです。動画を短くするか解像度を下げてください。`
      }, { status: 413 })
    }

    try {
      const uploadsDir = path.join(process.cwd(), 'data', 'uploads', 'videos')
      await mkdir(uploadsDir, { recursive: true })
      const videoId = uuidv4()
      const savedName = `${videoId}-${file.name}`
      const rawPath = path.join(uploadsDir, savedName)

      // arrayBuffer() の Buffer コピーを避けてストリームで書き込み（メモリ節約）
      await pipeline(
        Readable.fromWeb(file.stream() as Parameters<typeof Readable.fromWeb>[0]),
        createWriteStream(rawPath)
      )

      // 圧縮前に元の解像度を取得
      const originalDims = await getOriginalDimensions(rawPath)

      // アップロード後に解像度を圧縮（OCR読み取り可能レベルまで下げる）
      const compressedPath = await compressVideoForOcr(rawPath)

      const video: Video = {
        id: videoId,
        title: titleField?.trim() || file.name.replace(/\.[^.]+$/, ''),
        type: typeField as Video['type'],
        filePath: compressedPath,
        status: 'pending',
        ...(originalDims && {
          originalWidth: originalDims.width,
          originalHeight: originalDims.height,
          ...(originalDims.fps !== undefined && { originalFps: originalDims.fps }),
        }),
        createdAt: new Date().toISOString(),
      }
      db.data.videos.push(video)
      await db.write()
      return Response.json(video, { status: 201 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[videos/upload] エラー:', e)
      if (msg.includes('ENOSPC') || msg.includes('no space')) {
        return Response.json({ error: 'サーバーのディスク容量が不足しています。不要なデータを削除してください。' }, { status: 500 })
      }
      if (msg.includes('EACCES') || msg.includes('permission')) {
        return Response.json({ error: 'ファイルの書き込み権限がありません。サーバー設定を確認してください。' }, { status: 500 })
      }
      return Response.json({ error: `動画のアップロードに失敗しました: ${msg}` }, { status: 500 })
    }
  }

  const body = await request.json()
  const video: Video = {
    id: uuidv4(),
    title: body.title || '無題の動画',
    type: body.type || 'sample',
    url: body.url || undefined,
    filePath: body.filePath,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  db.data.videos.push(video)
  await db.write()
  return Response.json(video, { status: 201 })
}
