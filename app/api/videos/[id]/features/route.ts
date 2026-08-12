import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { analyzeVideo } from '@/lib/analysis/pipeline'
import { generateRuleCandidates, extractFrameTexts } from '@/lib/ai'
import { v4 as uuidv4 } from 'uuid'
import type { VideoFeature, RuleCandidate, Source, VideoStatus } from '@/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()
  const feature = db.data.videoFeatures.find(f => f.videoId === id)
  if (!feature) return Response.json(null)
  return Response.json(feature)
}

/** OCR・文字起こし結果を手動で修正する */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()
  const body = await request.json()

  const feature = db.data.videoFeatures.find(f => f.videoId === id)
  if (!feature) return Response.json({ error: '解析データが見つかりません' }, { status: 404 })

  // 編集可能フィールドのみ更新
  if (body.ocrTexts !== undefined)    feature.ocrTexts    = body.ocrTexts
  if (body.transcription !== undefined) feature.transcription = body.transcription
  // 後方互換フィールドも同期
  if (body.ocrTexts !== undefined)    feature.textContent  = body.ocrTexts.join('\n')
  if (body.transcription !== undefined) feature.audioContent = body.transcription

  await db.write()
  return Response.json(feature)
}

/** 失敗したステージに応じたユーザー向けエラーメッセージ */
function toUserFriendlyError(error: unknown, failedAt: VideoStatus): string {
  const raw = error instanceof Error ? error.message : String(error)
  const msg = raw.toLowerCase()

  if (failedAt === 'extracting_meta') {
    if (msg.includes('instagram') || msg.includes('tiktok') || msg.includes('cookie')) {
      return 'SNSの動画にアクセスできませんでした。設定画面でブラウザを選択し、そのブラウザでSNSにログインしてください。'
    }
    if (msg.includes('no such file') || msg.includes('not found')) {
      return '動画ファイルが見つかりません。ファイルが削除または移動されていないか確認してください。'
    }
    if (msg.includes('403') || msg.includes('401') || msg.includes('forbidden')) {
      return 'URLへのアクセスが拒否されました。公開されている動画のURLを使用してください。'
    }
    return '動画情報の取得に失敗しました。URLまたはファイルが正しいか確認してください。'
  }
  if (failedAt === 'extracting_frames') {
    return 'フレームの抽出に失敗しました。動画ファイルが破損していないか確認してください。'
  }
  if (failedAt === 'running_ocr') {
    return 'テキストの読み取りに失敗しました。時間をおいてから再試行してください。'
  }
  if (failedAt === 'transcribing') {
    if (msg.includes('model') || msg.includes('download') || msg.includes('onnx')) {
      return '音声文字起こしモデルのロードに失敗しました。初回起動時は最大244MBのダウンロードが必要です。ネットワーク接続を確認して再試行してください。'
    }
    return '音声の文字起こしに失敗しました。時間をおいてから再試行してください。'
  }
  if (failedAt === 'generating_candidates') {
    if (msg.includes('api key') || msg.includes('auth') || msg.includes('resolve authentication')
      || msg.includes('unauthorized') || msg.includes('invalid x-api-key')) {
      return 'ルール候補の生成に失敗しました。ANTHROPIC_API_KEY が正しく設定されているか確認してください。'
    }
    if (msg === 'TOKEN_LIMIT_EXCEEDED') {
      return '動画の解析データが多すぎて処理できませんでした。動画を短くするか、フレーム抽出間隔を広げてから再試行してください。'
    }
    if (msg === 'JSON_PARSE_FAILED') {
      return 'AIの応答を正しく解析できませんでした。時間をおいてから再試行してください。'
    }
    if (msg.includes('rate limit') || msg.includes('overloaded')) {
      return 'AIサービスが混雑しています。時間をおいてから再試行してください。'
    }
    return 'ルール候補の生成に失敗しました。時間をおいてから再試行してください。'
  }
  return '解析中にエラーが発生しました。時間をおいてから再試行してください。'
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await getDb()

  const video = db.data.videos.find(v => v.id === id && !v.deletedAt)
  if (!video) return Response.json({ error: '動画が見つかりません' }, { status: 404 })

  const source = video.filePath || video.url
  if (!source) {
    return Response.json({ error: '動画のURLまたはファイルパスが設定されていません' }, { status: 400 })
  }

  video.errorMessage = undefined
  await db.write()

  try {
    // ─── Stage 1: 特徴抽出 ──────────────────────────────────────────────
    // feature.extractedAt が存在する = Stage 1 は前回完了済み → スキップして Stage 2 へ
    let feature = db.data.videoFeatures.find(f => f.videoId === id)
    const stage1Done = Boolean(feature?.extractedAt)

    if (stage1Done) {
      console.log(`[pipeline] Stage 1 完了済みのためスキップ → Stage 2（ルール候補生成）のみ実行`)
    } else {
      // Stage 1 を実行
      video.status = 'extracting_meta'
      await db.write()

      const onOcrProgress = async (current: number, total: number) => {
        video.analysisProgress = { stage: 'ocr', current, total }
        await db.write()
      }

      // DB に明示的に設定されている場合のみ使用し、未設定なら undefined（env var にフォールバック）
      const settingsData = db.data.settings as Record<string, unknown> | undefined
      const transcriptionDisabled = settingsData && 'transcriptionDisabled' in settingsData
        ? !!settingsData.transcriptionDisabled
        : undefined

      const extracted = await analyzeVideo(source, id, async (status) => {
        video.status = status
        video.analysisProgress = undefined
        await db.write()
      }, onOcrProgress, transcriptionDisabled)

      // Vision OCR でフレームのテキストを抽出（60秒でタイムアウト、失敗時は空テキストのまま続行）
      const visionInterval: number = (db.data.settings as Record<string, unknown> | undefined)?.visionFrameInterval as number
        ?? parseInt(process.env.VISION_FRAME_INTERVAL || '1')

      const onVisionProgress = async (current: number, total: number) => {
        video.analysisProgress = { stage: 'vision_ocr', current, total }
        await db.write()
      }

      // バッチ処理のため、タイムアウトはバッチ数に応じて伸ばす（1バッチ60秒 × バッチ数）
      const estimatedBatches = Math.ceil(extracted.frames.length / 20) || 1
      const visionTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Vision OCR timeout')), 60_000 * estimatedBatches)
      )
      const correctedFrames = await Promise.race([
        extractFrameTexts(extracted.frames, onVisionProgress, visionInterval),
        visionTimeout,
      ]).catch(() => extracted.frames)

      video.analysisProgress = undefined
      await db.write()
      extracted.frames = correctedFrames
      extracted.ocrTexts = [...new Set(correctedFrames.map(f => f.ocrText).filter(t => t.length > 0))]

      // ── Stage 1 完了後、即座に保存（Stage 2 が失敗しても再開できるように）──
      const featureData: Omit<VideoFeature, 'id' | 'videoId' | 'createdAt'> = {
        meta: extracted.meta,
        frames: extracted.frames,
        ocrTexts: extracted.ocrTexts,
        transcription: extracted.transcription,
        transcriptChunks: extracted.transcriptChunks,
        extractedAt: extracted.extractedAt,
        textContent: extracted.ocrTexts.join('\n'),
        audioContent: extracted.transcription,
        duration: extracted.meta.duration,
      }

      if (feature) {
        Object.assign(feature, featureData)
      } else {
        const newFeature: VideoFeature = {
          id: uuidv4(),
          videoId: id,
          ...featureData,
          createdAt: new Date().toISOString(),
        }
        db.data.videoFeatures.push(newFeature)
        feature = newFeature
      }

      await db.write()
      console.log(`[pipeline] Stage 1 データを保存しました（再開可能になりました）`)

      // お手本動画はここで一時停止して、ユーザーにOCR・文字起こしの確認を促す
      if (video.type === 'sample') {
        video.status = 'awaiting_review'
        await db.write()
        const feature = db.data.videoFeatures.find(f => f.videoId === id)!
        return Response.json(feature)
      }
    }

    // ─── Stage 2: ルール候補生成（Stage 1 完了済みの再実行パス）─────────────
    // ※ お手本動画の Stage 2 は /generate-candidates エンドポイントから呼ばれる
    if (stage1Done && video.type === 'sample') {
      video.status = 'generating_candidates'
      await db.write()

      const guidelines = db.data.guidelines.filter(g => !g.deletedAt)
      const candidates = await generateRuleCandidates(feature!, guidelines)

      const videoSource: Source = { type: 'sampleVideo', id: video.id, name: video.title }
      for (const c of candidates) {
        // 同じ内容の候補が既に存在する場合は重複追加しない
        const alreadyExists = db.data.ruleCandidates.some(
          rc => rc.videoId === id && rc.content === c.content
        )
        if (!alreadyExists) {
          db.data.ruleCandidates.push({
            id: uuidv4(),
            videoId: id,
            source: videoSource,
            content: c.content,
            category: c.category,
            reason: c.reason,
            approvalStatus: 'pending',
            createdAt: new Date().toISOString(),
          } as RuleCandidate)
        }
      }
    }

    video.status = 'analyzed'
    await db.write()

    return Response.json(feature)

  } catch (error) {
    const errorMessage = toUserFriendlyError(error, video.status)
    video.status = 'error'
    video.errorMessage = errorMessage
    await db.write()
    console.error('Analysis pipeline error:', error)
    return Response.json({ error: errorMessage }, { status: 500 })
  }
}
