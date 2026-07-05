import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { readFile } from 'fs/promises'
import path from 'path'

function getClient(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  if (!accountId || !accessKeyId || !secretAccessKey) return null

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  })
}

export function isR2Enabled(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  )
}

export async function uploadToR2(key: string, filePath: string, contentType = 'image/jpeg'): Promise<void> {
  const client = getClient()
  const bucket = process.env.R2_BUCKET
  if (!client || !bucket) return

  const body = await readFile(filePath)
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }))
}

export async function uploadFramesToR2(
  videoId: string,
  frames: Array<{ path: string; timestamp: number }>,
): Promise<void> {
  if (!isR2Enabled()) return

  let uploaded = 0
  for (const frame of frames) {
    const key = `frames/${videoId}/${path.basename(frame.path)}`
    await uploadToR2(key, frame.path)
    uploaded++
  }
  console.log(`[r2] ${uploaded} フレームをアップロード完了 (video: ${videoId})`)
}

export async function deleteFramesFromR2(videoId: string): Promise<void> {
  const client = getClient()
  const bucket = process.env.R2_BUCKET
  if (!client || !bucket) return

  const listed = await client.send(new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: `frames/${videoId}/`,
  }))

  for (const obj of listed.Contents ?? []) {
    if (obj.Key) await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }))
  }
  console.log(`[r2] フレーム削除完了 (video: ${videoId})`)
}

// 保持期間を過ぎたフレームを一括削除（cron から呼び出す）
export async function deleteExpiredFrames(retentionDays: number): Promise<{ deleted: number; errors: number }> {
  const client = getClient()
  const bucket = process.env.R2_BUCKET
  if (!client || !bucket) return { deleted: 0, errors: 0 }

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  let deleted = 0
  let errors = 0
  let token: string | undefined

  do {
    const listed = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: 'frames/',
      ContinuationToken: token,
    }))

    for (const obj of listed.Contents ?? []) {
      if (!obj.Key || !obj.LastModified) continue
      if (obj.LastModified < cutoff) {
        try {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }))
          deleted++
        } catch {
          errors++
        }
      }
    }

    token = listed.NextContinuationToken
  } while (token)

  console.log(`[r2] 期限切れフレーム削除: ${deleted}件 (${retentionDays}日超, エラー: ${errors}件)`)
  return { deleted, errors }
}
