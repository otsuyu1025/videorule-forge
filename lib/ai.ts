import Anthropic from '@anthropic-ai/sdk'
import type { VideoFeature, ProductionRule, InspectionResult, Guideline } from '@/types'

const MODEL = 'claude-haiku-4-5-20251001'
// Haiku 4.5 料金（2026年7月時点）
const PRICE_INPUT_PER_M  = 1.00  // $1.00 / 1Mトークン
const PRICE_OUTPUT_PER_M = 5.00  // $5.00 / 1Mトークン

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * API呼び出し前にトークン数と推定費用をログ出力する。
 * count_tokens は課金されないが追加レイテンシがある（開発/監視用途）。
 */
async function logTokenCount(
  label: string,
  params: Parameters<typeof anthropic.messages.countTokens>[0]
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
 * Stage 1（特徴抽出）の結果を人間が読みやすい文字列に変換する
 * originalDims: 圧縮前の元解像度（ある場合は優先してルール判定に使う）
 */
function buildFeatureDescription(
  feature: VideoFeature,
  originalDims?: { width: number; height: number } | null
): string {
  const lines: string[] = []

  if (feature.meta) {
    lines.push('【動画メタ情報】')
    lines.push(`・尺: ${feature.meta.duration}秒`)

    // 元解像度がある場合は「元の解像度（ルール判定用）」として明示する
    if (originalDims) {
      lines.push(`・元の解像度（圧縮前・ルール判定用）: ${originalDims.width}×${originalDims.height}`)
      lines.push(`・解析時解像度（圧縮後）: ${feature.meta.width}×${feature.meta.height}`)
    } else {
      lines.push(`・解像度: ${feature.meta.width}×${feature.meta.height}（※この値は圧縮後のものです）`)
    }

    lines.push(`・FPS: ${feature.meta.fps}`)
    lines.push(`・コーデック: ${feature.meta.videoCodec}`)
    lines.push(`・ビットレート: ${feature.meta.bitrate}kbps`)
    lines.push(`・音声: ${feature.meta.hasAudio ? `あり（${feature.meta.audioCodec ?? '不明'}）` : 'なし'}`)
    lines.push(`・ファイルサイズ: ${Math.round(feature.meta.fileSize / 1024)}KB`)
  } else if (feature.duration) {
    lines.push('【動画メタ情報】')
    lines.push(`・尺: ${feature.duration}秒`)
  }

  // OCRテキスト（Stage 1: Tesseract）
  const ocrText = feature.ocrTexts?.join('\n') || feature.textContent || ''
  lines.push('\n【画面テキスト（OCR）】')
  lines.push(ocrText || '（テキストなし）')

  // 音声文字起こし（Stage 1: Whisper）
  const transcription = feature.transcription || feature.audioContent || ''
  lines.push('\n【音声文字起こし（Whisper）】')
  lines.push(transcription || '（音声なし、または取得できず）')

  return lines.join('\n')
}

export async function generateRuleCandidates(
  feature: VideoFeature,
  guidelines: Array<{ title: string; content: string }>,
  originalDims?: { width: number; height: number } | null
): Promise<Array<{ content: string; category: string; reason: string }>> {
  const guidelineText = guidelines.length > 0
    ? `\n\n【参照ガイドライン】\n${guidelines.map(g => `▼${g.title}\n${g.content}`).join('\n\n')}`
    : ''

  const featureText = buildFeatureDescription(feature, originalDims)

  const prompt = `あなたは動画制作の品質管理の専門家です。
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

  const callParams = { model: MODEL, max_tokens: 4096, messages: [{ role: 'user' as const, content: prompt }] }
  await logTokenCount('ルール候補生成', callParams)

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
  originalDims?: { width: number; height: number } | null
): Promise<InspectionResult[]> {
  if (rules.length === 0) return []

  const rulesText = rules.map((r, i) =>
    `${i + 1}. [${r.id}] ${r.content}（カテゴリ: ${r.category}）`
  ).join('\n')

  const featureText = buildFeatureDescription(feature, originalDims)

  const prompt = `あなたは動画品質検査の専門家です。
以下の動画特徴と動画制作ルールを照合し、各ルールの適合状況を判定してください。

${featureText}

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

  const callParams = { model: MODEL, max_tokens: 4096, messages: [{ role: 'user' as const, content: prompt }] }
  await logTokenCount('動画検品', callParams)

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
  await logTokenCount('ガイドライン解析', callParams)

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
