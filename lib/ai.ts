import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import type { VideoFeature, ProductionRule, InspectionResult, Guideline, FrameData, YakujiSettings } from '@/types'

const MODEL = 'claude-haiku-4-5-20251001'
// Haiku 4.5 料金（2026年7月時点）
const PRICE_INPUT_PER_M  = 1.00  // $1.00 / 1Mトークン
const PRICE_OUTPUT_PER_M = 5.00  // $5.00 / 1Mトークン

// inspectVideo/generateRuleCandidates で使うフレーム上限
// VIDEO_VISION_MAX_FRAMES 環境変数で上書き可能（Railway などで調整）
// デフォルト 15 枚 × visionInterval秒 = カバー可能秒数（例: 15×2s=30s）
const MAX_VISION_FRAMES = parseInt(process.env.VIDEO_VISION_MAX_FRAMES || '15')
// Anthropic の1リクエストあたりの画像上限
const VISION_BATCH_SIZE = 20

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 120_000, // 2分でタイムアウト（デフォルト10分は長すぎるため）
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
  maxFrames: number,
  visionInterval = parseInt(process.env.VISION_FRAME_INTERVAL || '1')
): Array<{ timestamp: number; filename: string; ocrText: string; base64: string | null }> {
  if (!frames || frames.length === 0) return []

  // visionInterval 秒ごとに1枚サンプリング、上限 maxFrames 枚
  let selected = frames.filter(f => f.timestamp % visionInterval === 0).slice(0, maxFrames)
  if (selected.length === 0) selected = [frames[0]] // 最低1枚確保

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
  frames: FrameData[],
  visionInterval = parseInt(process.env.VISION_FRAME_INTERVAL || '1')
): Anthropic.MessageParam['content'] {
  const visionFrames = loadFramesForVision(frames, MAX_VISION_FRAMES, visionInterval)
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

/**
 * フレーム画像から Vision で正確なテキストを抽出し、Tesseract の文字化けを上書きする。
 * 失敗時は元の frames をそのまま返す（Tesseract 結果を維持）。
 */
export async function extractFrameTexts(
  frames: FrameData[],
  onProgress?: (current: number, total: number) => Promise<void>,
  visionInterval = parseInt(process.env.VISION_FRAME_INTERVAL || '1')
): Promise<FrameData[]> {
  if (!frames || frames.length === 0) return frames

  // visionInterval 秒ごとに1枚サンプリング（上限 MAX_VISION_FRAMES 枚）
  let sampled = frames.filter(f => f.timestamp % visionInterval === 0).slice(0, MAX_VISION_FRAMES)
  if (sampled.length === 0) sampled = [frames[0]]

  // ファイルが存在するものだけ絞り込む（base64 はまだ読まない）
  const sampledMeta = sampled.filter(f => f.imagePath && existsSync(f.imagePath))
  if (sampledMeta.length === 0) return frames

  const textMap: Record<number, string> = {}
  const totalBatches = Math.ceil(sampledMeta.length / VISION_BATCH_SIZE)
  console.log(`[VisionOCR] ${sampledMeta.length}枚を${totalBatches}バッチで処理（遅延読み込み）`)

  let processed = 0
  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const batchMeta = sampledMeta.slice(batchIdx * VISION_BATCH_SIZE, (batchIdx + 1) * VISION_BATCH_SIZE)

    // このバッチ分だけ base64 を読み込む（処理後にスコープを抜けてGCに解放される）
    const batchWithImages: Array<{ timestamp: number; ocrText: string; base64: string }> = []
    for (const f of batchMeta) {
      try {
        const base64 = readFileSync(f.imagePath!).toString('base64')
        batchWithImages.push({ timestamp: f.timestamp, ocrText: f.ocrText, base64 })
      } catch { /* ファイル読み込み失敗はスキップ */ }
    }

    if (batchWithImages.length === 0) {
      processed += batchMeta.length
      await onProgress?.(processed, sampledMeta.length)
      continue
    }

    const content: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [
      { type: 'text', text: '各フレーム画像に表示されているテキスト（テロップ・字幕・ロゴ文字など）を正確に読み取ってください。テキストがない場合は空文字にしてください。\n\nJSON形式で回答:\n{"frames":[{"timestamp":<秒数>,"text":"<検出テキスト>"}]}' },
    ]
    for (const f of batchWithImages) {
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.base64 } })
      content.push({ type: 'text', text: `↑ ${f.timestamp}秒時点` })
    }

    try {
      const message = await anthropic.messages.create({ model: MODEL, max_tokens: 1024, messages: [{ role: 'user', content }] })
      logUsage(`Vision OCR バッチ${batchIdx + 1}/${totalBatches}`, message.usage)
      const raw = message.content[0].type === 'text' ? message.content[0].text : ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        for (const f of (parsed.frames || [])) textMap[f.timestamp] = f.text ?? ''
      }
    } catch (e) {
      console.error('[VisionOCR] バッチ失敗:', e instanceof Error ? e.message : e)
    }

    processed += batchWithImages.length
    await onProgress?.(processed, sampledMeta.length)
    // batchWithImages はここでスコープを抜け、base64 データが GC の対象になる
  }

  const corrected = frames.map(f => ({
    ...f,
    ocrText: textMap[f.timestamp] !== undefined ? textMap[f.timestamp] : f.ocrText,
  }))
  const detected = corrected.filter(f => f.ocrText.length > 0).length
  console.log(`[VisionOCR] テキスト修正完了: ${detected}/${frames.length}枚`)
  return corrected
}

export async function generateRuleCandidates(
  feature: VideoFeature,
  guidelines: Array<{ title: string; content: string }>,
  originalDims?: { width: number; height: number; fps?: number } | null,
  visionInterval = parseInt(process.env.VISION_FRAME_INTERVAL || '3')
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

  const messageContent = buildVisionContent(promptText, feature.frames || [], visionInterval)
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
  originalDims?: { width: number; height: number; fps?: number } | null,
  visionInterval = parseInt(process.env.VISION_FRAME_INTERVAL || '3')
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
      "reason": "判定理由。NGの場合、ルールに数値・色コード・時間・文字数など具体的な仕様が明示されているときは、検出した実際の値と規定値を対比し、修正内容を明記すること（例：「フォントサイズが約8pxで、規定の12px以上を満たしていません。12px以上に修正してください」「背景色が#FFFFFFで規定の#272343と異なります。#272343に変更してください」）。規定値が明示されていない場合は判定根拠のみ記述。",
      "actionItem": "NG・要確認の場合のみ、サマリー表示用の簡潔な修正指示を1文で記述（例：「フォントサイズを12px以上に修正」「背景色を#272343に変更」）。「〜してください」は不要。OKの場合はnull。規定値がある場合は必ず値を含めること。",
      "confidence": 0.0〜1.0の数値
    }
  ]
}`

  const messageContent = buildVisionContent(promptText, feature.frames || [], visionInterval)
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

export async function inspectYakuji(
  feature: VideoFeature,
  yakuji: YakujiSettings,
): Promise<InspectionResult[]> {
  if (!yakuji.enabled || !yakuji.rules || yakuji.rules.length === 0) return []

  // enabled: false のルールを除外してトークン節約・不要な呼び出しをスキップ
  const enabledRules = yakuji.rules.filter(r => r.enabled !== false)
  if (enabledRules.length === 0) return []

  const textSources: string[] = []
  if (feature.ocrTexts && feature.ocrTexts.length > 0) {
    textSources.push(`【字幕・テロップ（OCR）】\n${feature.ocrTexts.join('\n')}`)
  }
  if (feature.transcription) {
    textSources.push(`【音声文字起こし】\n${feature.transcription}`)
  }
  if (textSources.length === 0) {
    textSources.push('（テキスト・音声データなし）')
  }

  const rulesText = enabledRules.map(r =>
    `[${r.id}] ${r.label}: ${r.description}\nNG例: ${r.examples_ng.join('、')}`
  ).join('\n\n')

  const prompt = `あなたは日本の薬機法（医薬品医療機器等法）の広告審査の専門家です。
以下の動画テキスト・音声内容を、薬機法の観点から審査してください。

${textSources.join('\n\n')}

【薬機法判定カテゴリ】
${rulesText}

各カテゴリについて判定し、JSONで回答してください。
NGがある場合は各カテゴリを個別に、NGがない場合は全体をまとめて1件だけ出力してください：
{
  "violations": [
    {
      "ruleId": "yakuji_カテゴリID または yakuji_overall",
      "ruleContent": "薬機法チェック項目の名称",
      "category": "薬機法",
      "judgment": "OK" | "NG",
      "reason": "判定理由（該当テキストを引用し、なぜ問題か・または問題ない理由を具体的に）",
      "actionItem": "NGの場合のみ、サマリー表示用の簡潔な修正指示を1文で記述。形式：「『〔該当表現〕』という表現は、〔必要な対応〕こと」。OKの場合はnull。",
      "confidence": 0.0〜1.0
    }
  ]
}
違反がない場合は violations に ruleId="yakuji_overall" のOK結果を1件だけ含めてください。`

  const callParams = { model: MODEL, max_tokens: 2048, messages: [{ role: 'user' as const, content: prompt }] }
  await logTokenCount('薬機法検品', { model: MODEL, messages: callParams.messages })

  const message = await anthropic.messages.create(callParams)
  logUsage('薬機法検品', message.usage)

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []

  try {
    const parsed = JSON.parse(jsonMatch[0])
    const violations = (parsed.violations || []) as InspectionResult[]
    if (violations.length === 0) {
      return [{
        ruleId: 'yakuji_overall',
        ruleContent: '薬機法（医薬品医療機器等法）コンプライアンス',
        category: '薬機法',
        judgment: 'OK',
        reason: '薬機法違反の疑いのある表現は検出されませんでした。',
        confidence: 1.0,
      }]
    }
    return violations.map(v => ({ ...v, category: '薬機法' }))
  } catch {
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

  // Haiku 4.5 の出力上限は 8192 トークン。ガイドラインが長い場合に4096で打ち切られるため上限まで使う
  const callParams = { model: MODEL, max_tokens: 8192, messages: [{ role: 'user' as const, content: prompt }] }
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
