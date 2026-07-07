import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import type { VideoFeature, ProductionRule, InspectionResult, Guideline, FrameData } from '@/types'

const MODEL = 'claude-haiku-4-5-20251001'
// Haiku 4.5 料金（2026年7月時点）
const PRICE_INPUT_PER_M  = 1.00  // $1.00 / 1Mトークン
const PRICE_OUTPUT_PER_M = 5.00  // $5.00 / 1Mトークン

// ビジョン解析に使うフレームの最大枚数（多すぎるとトークン増大）
const MAX_VISION_FRAMES = 10

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * API呼び出し前にトークン数と推定費用をログ出力する。
 * count_tokens は課金されないが追加レイテンシがある（開発/監視用途）。
 */
async function logTokenCount(
  label: string,
  // countTokens は max_tokens を受け付けないため、必要なフィールドのみ渡す
  params: { model: string; messages: Anthropic.MessageParam[]; system?: string }
): Promise<void> {
  try {
    const count = await anthropic.messages.countTokens(params)
    const estimatedInputCost = (count.input_tokens / 1_000_000) * PRICE_INPUT_PER_M
    console.log(
      `[AI] ${label} 入力トークン数: ${count.input_tokens.toLocaleString()} ` +
      `(推定 $${estimatedInputCost.toFixed(5)})`
    )
  } catch (e) {
    // トークンカウント失敗はログのみ（本処理に影響しない）
    console.error('[AI] トークンカウント失敗:', e instanceof Error ? e.message : e)
  }
}

/** API呼び出し後の実際の使用量をログ出力する */
function logUsage(label: string, usage: Anthropic.Usage): void {
  const inputCost  = (usage.input_tokens  / 1_000_000) * PRICE_INPUT_PER_M
  const outputCost = (usage.output_tokens / 1_000_000) * PRICE_OUTPUT_PER_M
  const totalCost  = inputCost + outputCost
  console.log(
    `[AI] ${label} 実績: 入力=${usage.input_tokens.toLocaleString()} / ` +
    `出力=${usage.output_tokens.toLocaleString()} / ` +
    `費用 $${totalCost.toFixed(5)}`
  )
}

/**
 * 連続するフレームのOCRテキストからテロップ表示タイムラインを構築する。
 * 同じテキストが N フレーム連続 = N × frameInterval 秒間表示されているとみなす。
 */
function buildTelopTimeline(frames: FrameData[], frameInterval: number): string {
  if (!frames || frames.length === 0) return '（フレームデータなし）'

  const segments: Array<{ text: string; startTime: number; frameCount: number }> = []

  for (const frame of frames) {
    const text = frame.ocrText.trim()
    const last = segments[segments.length - 1]
    if (last && last.text === text) {
      last.frameCount++
    } else {
      segments.push({ text, startTime: frame.timestamp, frameCount: 1 })
    }
  }

  const textSegments = segments.filter(s => s.text.length > 0)
  if (textSegments.length === 0) return '（テロップ検出なし）'

  return textSegments.map(s => {
    const duration = s.frameCount * frameInterval
    const endTime = s.startTime + duration
    return `・「${s.text}」: ${s.startTime}秒〜${endTime}秒（${duration}秒間表示）`
  }).join('\n')
}

/**
 * フレーム画像を均等サンプリングしてbase64で読み込む。
 * ファイルが存在しない場合は base64=null になる。
 */
function loadFramesForVision(
  frames: FrameData[],
  maxFrames: number
): Array<{ timestamp: number; filename: string; ocrText: string; base64: string | null }> {
  if (!frames || frames.length === 0) return []

  // 均等サンプリング
  const step = frames.length <= maxFrames ? 1 : Math.floor(frames.length / maxFrames)
  const selected: FrameData[] = []
  for (let i = 0; i < frames.length && selected.length < maxFrames; i += step) {
    selected.push(frames[i])
  }

  return selected.map(f => {
    const filename = f.imagePath ? path.basename(f.imagePath) : `frame-${f.timestamp}s.jpg`
    let base64: string | null = null
    if (f.imagePath && existsSync(f.imagePath)) {
      try {
        base64 = readFileSync(f.imagePath).toString('base64')
      } catch {
        // ファイル読み込み失敗は無視（R2使用時などは imagePath がサーバーローカルに存在しない）
      }
    }
    return { timestamp: f.timestamp, filename, ocrText: f.ocrText, base64 }
  })
}

/**
 * Stage 1（特徴抽出）の結果を人間が読みやすい文字列に変換する
 * originalDims: 圧縮前の元解像度（ある場合は優先してルール判定に使う）
 */
function buildFeatureDescription(
  feature: VideoFeature,
  originalDims?: { width: number; height: number; fps?: number } | null
): string {
  const lines: string[] = []

  if (feature.meta) {
    lines.push('【動画メタ情報】')
    lines.push(`・尺: ${feature.meta.duration}秒`)

    if (originalDims) {
      lines.push(`・元の解像度（圧縮前・ルール判定用）: ${originalDims.width}×${originalDims.height}`)
      lines.push(`・解析時解像度（圧縮後）: ${feature.meta.width}×${feature.meta.height}`)
      if (originalDims.fps !== undefined) {
        lines.push(`・元のフレームレート（圧縮前・ルール判定用）: ${originalDims.fps}fps`)
      } else {
        lines.push(`・フレームレート: ${feature.meta.fps}fps（※圧縮後の値）`)
      }
    } else {
      lines.push(`・解像度: ${feature.meta.width}×${feature.meta.height}（※この値は圧縮後のものです）`)
      lines.push(`・フレームレート: ${feature.meta.fps}fps（※この値は圧縮後のものです）`)
    }
    lines.push(`・コーデック: ${feature.meta.videoCodec}`)
    lines.push(`・ビットレート: ${feature.meta.bitrate}kbps`)
    lines.push(`・音声: ${feature.meta.hasAudio ? `あり（${feature.meta.audioCodec ?? '不明'}）` : 'なし'}`)
    lines.push(`・ファイルサイズ: ${Math.round(feature.meta.fileSize / 1024)}KB`)
  } else if (feature.duration) {
    lines.push('【動画メタ情報】')
    lines.push(`・尺: ${feature.duration}秒`)
  }

  // OCRテキスト（重複除去済み）
  const ocrText = feature.ocrTexts?.join('\n') || feature.textContent || ''
  lines.push('\n【画面テキスト（OCR・重複除去済み）】')
  lines.push(ocrText || '（テキストなし）')

  // テロップ表示タイムライン（連続フレームから表示秒数を推定）
  if (feature.frames && feature.frames.length > 0) {
    const frameInterval = parseInt(process.env.VIDEO_FRAME_INTERVAL || '1')
    lines.push(`\n【テロップ表示タイムライン（フレーム間隔: ${frameInterval}秒）】`)
    lines.push('※同じテキストが連続フレームに表示されている場合、その秒数分だけ表示されているとみなします')
    lines.push(buildTelopTimeline(feature.frames, frameInterval))
  }

  // 音声文字起こし（Stage 1: Whisper）
  const transcriptionDisabled = process.env.DISABLE_TRANSCRIPTION === 'true'
  const transcription = feature.transcription || feature.audioContent || ''
  lines.push('\n【音声文字起こし（Whisper）】')
  if (transcriptionDisabled) {
    lines.push('音声文字起こしは現在無効（DISABLE_TRANSCRIPTION=true）です。音声内容はルール判定に使用されていません。音声に関するルールは「要確認」と判定し、その旨を理由に明記してください。')
  } else {
    lines.push(transcription || '（音声なし、または取得できず）')
  }

  return lines.join('\n')
}

/** ビジョンブロック込みのメッセージ content を構築する */
function buildVisionContent(
  promptText: string,
  frames: FrameData[]
): Anthropic.MessageParam['content'] {
  const visionFrames = loadFramesForVision(frames, MAX_VISION_FRAMES)
  const availableFrames = visionFrames.filter(f => f.base64 !== null)

  if (availableFrames.length === 0) {
    // フレーム画像が取得できない場合はテキストのみ
    return promptText
  }

  const content: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [
    { type: 'text', text: promptText },
  ]

  for (const frame of availableFrames) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: frame.base64! },
    })
    content.push({
      type: 'text',
      text: `↑ 動画${frame.timestamp}秒時点のフレーム　OCR参考値:「${frame.ocrText || 'なし'}」（文字化けしている場合はこの画像から直接テキストを読んでください）`,
    })
  }

  console.log(`[AI] ビジョン解析: ${availableFrames.length}枚のフレーム画像を添付`)
  return content
}

export async function generateRuleCandidates(
  feature: VideoFeature,
  guidelines: Array<{ title: string; content: string }>,
  originalDims?: { width: number; height: number; fps?: number } | null
): Promise<Array<{ content: string; category: string; reason: string }>> {
  const guidelineText = guidelines.length > 0
    ? `\n\n【参照ガイドライン】\n${guidelines.map(g => `▼${g.title}\n${g.content}`).join('\n\n')}`
    : ''

  const featureText = buildFeatureDescription(feature, originalDims)

  const promptText = `あなたは動画制作の品質管理の専門家です。
以下の動画特徴（OCR・音声文字起こし・メタ情報）をもとに、動画制作ルールの候補を提案してください。${guidelineText}

${featureText}

JSONで回答してください。3〜5個のルール候補を返してください:
{
  "candidates": [
    {
      "content": "ルールの内容（具体的に）",
      "category": "カテゴリ（例: ブランドカラー, テキスト, 構成, 音声, コンプライアンスなど）",
      "reason": "このルールを提案する根拠（上記の動画特徴のどの情報に基づくか）"
    }
  ]
}`

  const messageContent = buildVisionContent(promptText, feature.frames || [])
  const callParams = { model: MODEL, max_tokens: 4096, messages: [{ role: 'user' as const, content: messageContent }] }
  await logTokenCount('ルール候補生成', { model: MODEL, messages: callParams.messages })

  const message = await anthropic.messages.create(callParams)
  logUsage('ルール候補生成', message.usage)

  if (message.stop_reason === 'max_tokens') {
    throw new Error('TOKEN_LIMIT_EXCEEDED')
  }

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('JSON_PARSE_FAILED')
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return parsed.candidates || []
  } catch {
    console.error('[AI] JSON parse error (candidates):', jsonMatch[0].slice(0, 200))
    throw new Error('JSON_PARSE_FAILED')
  }
}

export async function inspectVideo(
  feature: VideoFeature,
  rules: ProductionRule[],
  originalDims?: { width: number; height: number; fps?: number } | null
): Promise<InspectionResult[]> {
  if (rules.length === 0) return []

  const rulesText = rules.map((r, i) =>
    `${i + 1}. [${r.id}] ${r.content}（カテゴリ: ${r.category}）`
  ).join('\n')

  const featureText = buildFeatureDescription(feature, originalDims)
  const frameInterval = parseInt(process.env.VIDEO_FRAME_INTERVAL || '1')
  const visionFrames = loadFramesForVision(feature.frames || [], MAX_VISION_FRAMES)
  const hasVision = visionFrames.some(f => f.base64 !== null)

  const promptText = `あなたは動画品質検査の専門家です。
以下の動画特徴と動画制作ルールを照合し、各ルールの適合状況を判定してください。

${featureText}
${hasVision ? `
【添付フレーム画像について】
フレームは動画から${frameInterval}秒ごとに抽出したものです。各フレームには「動画X秒時点」と記載しています。

＜画像参照の指示＞
1. ロゴ・カラー・フォント・テロップ配置など視覚的に判断できるルールは必ずフレーム画像を確認してください。
2. フレームを言及するときは「frame-Xs.jpg」ではなく「動画X秒時点」「動画開始からX〜Y秒」のような表現を使ってください。
3. OCR参考値が文字化け・ノイズを含む場合は、フレーム画像から直接テキストを読み取り、その内容を使用してください。
4. テロップ表示時間: 同じテキストが複数の連続フレームに見える場合、「動画X秒〜Y秒の間（約Z秒間）表示」のように推定してください。

＜フォント・文字サイズの推定方法＞
フォント種別: 画像から「明朝体」「ゴシック体」「サンセリフ体」等を視覚的に特定してください。
文字サイズ: フレーム解像度を基準に推定してください。
  例: 解像度360×640px の場合、文字高さがフレーム高さの約5%なら約32px。
  動画制作では「フレーム高さの何%か」または「約Xpx」で記載してください。
  pt換算が必要な場合は「72dpiを仮定すると約Xpt相当」と付記してください。` : ''}

【動画制作ルール】
${rulesText}

各ルールについて判定してください。JSONで回答:
{
  "results": [
    {
      "ruleId": "ルールのID",
      "ruleContent": "ルールの内容",
      "judgment": "OK" | "NG" | "要確認",
      "reason": "判定理由（動画特徴のどの情報に基づくか具体的に）",
      "confidence": 0.0〜1.0の数値
    }
  ]
}`

  const messageContent = buildVisionContent(promptText, feature.frames || [])
  const callParams = { model: MODEL, max_tokens: 4096, messages: [{ role: 'user' as const, content: messageContent }] }
  await logTokenCount('動画検品', { model: MODEL, messages: callParams.messages })

  const message = await anthropic.messages.create(callParams)
  logUsage('動画検品', message.usage)

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return parsed.results || []
  } catch {
    console.error('[AI] JSON parse error (results):', jsonMatch[0].slice(0, 200))
    return []
  }
}

export async function generateRuleCandidatesFromGuideline(
  guideline: Guideline
): Promise<Array<{ content: string; category: string; reason: string }>> {
  const prompt = `あなたは動画制作の品質管理の専門家です。以下の企業ガイドラインから、動画制作ルールの候補を提案してください。

ガイドライン「${guideline.title}」:
${guideline.content}

このガイドラインの内容を動画制作ルールとして整理してください。JSONで回答:
{
  "candidates": [
    {
      "content": "ルールの内容（具体的に）",
      "category": "カテゴリ（例: ブランドカラー, テキスト, 構成, 音声, コンプライアンスなど）",
      "reason": "このガイドラインのどの記述に基づくか"
    }
  ]
}`

  const callParams = { model: MODEL, max_tokens: 4096, messages: [{ role: 'user' as const, content: prompt }] }
  await logTokenCount('ガイドライン解析', { model: MODEL, messages: callParams.messages })

  const message = await anthropic.messages.create(callParams)
  logUsage('ガイドライン解析', message.usage)

  if (message.stop_reason === 'max_tokens') {
    throw new Error('TOKEN_LIMIT_EXCEEDED')
  }

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('JSON_PARSE_FAILED')
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return parsed.candidates || []
  } catch {
    console.error('[AI] JSON parse error (guideline):', jsonMatch[0].slice(0, 200))
    throw new Error('JSON_PARSE_FAILED')
  }
}
