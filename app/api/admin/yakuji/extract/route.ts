import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { YakujiRule } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function extractTextFromUrl(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`URL取得失敗: ${res.status}`)
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('pdf')) {
    const buf = await res.arrayBuffer()
    return extractTextFromPdfBuffer(Buffer.from(buf))
  }
  const html = await res.text()
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20000)
}

async function extractTextFromPdfBuffer(buf: Buffer): Promise<string> {
  // pdf-parse は CommonJS モジュールのため動的 require を使用
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buf)
  return (data.text as string).slice(0, 20000)
}

function extractJson(text: string): string | null {
  // コードブロック内のJSONを優先して抽出
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) return codeBlock[1].trim()
  // 裸のJSONオブジェクトを抽出（最外側の { } を対象）
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) return text.slice(start, end + 1)
  return null
}

const EXTRACT_PROMPT = (text: string) => `あなたは日本の薬機法（医薬品医療機器等法）の広告規制の専門家です。
以下の資料テキストを解析し、動画広告の審査に使える薬機法判定ルールを抽出・整理してください。
資料が法令全文の場合は広告規制・誇大広告・虚偽広告に関する条文を重点的に参照してください。

【資料テキスト】
${text}

必ず以下のJSON形式のみで回答してください（説明文は不要）：
{
  "source_name": "資料名（例: 医薬品等適正広告基準（令和○年改正））",
  "source_updated_at": "更新日（YYYY-MM-DD形式、不明な場合はnull）",
  "rules": [
    {
      "id": "yakuji_英数字のスネークケース",
      "label": "カテゴリ名（短く）",
      "description": "判定基準の説明（具体的に、100字以内）",
      "examples_ng": ["NG表現例1", "NG表現例2"],
      "examples_ok": ["OK表現例1", "OK表現例2"]
    }
  ]
}
ルールは5〜10件程度にまとめてください。`

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let rawText = ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const url = form.get('url') as string | null
      const file = form.get('pdf') as File | null

      if (url) {
        rawText = await extractTextFromUrl(url)
      } else if (file) {
        const buf = Buffer.from(await file.arrayBuffer())
        rawText = await extractTextFromPdfBuffer(buf)
      } else {
        return Response.json({ error: 'url または pdf が必要です' }, { status: 400 })
      }
    } else {
      const body = await request.json()
      if (body.url) {
        rawText = await extractTextFromUrl(body.url)
      } else {
        return Response.json({ error: 'url が必要です' }, { status: 400 })
      }
    }

    if (!rawText.trim()) {
      return Response.json({ error: 'テキストを抽出できませんでした' }, { status: 422 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: EXTRACT_PROMPT(rawText) }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('[yakuji/extract] Claude response (first 500):', text.slice(0, 500))
    const jsonStr = extractJson(text)
    if (!jsonStr) return Response.json({ error: 'AIが有効なJSON形式で回答しませんでした。別のURLやPDFをお試しください。' }, { status: 500 })

    const parsed = JSON.parse(jsonStr) as {
      source_name: string
      source_updated_at: string | null
      rules: YakujiRule[]
    }

    return Response.json({
      source_name: parsed.source_name,
      source_updated_at: parsed.source_updated_at,
      rules: parsed.rules,
    })
  } catch (e) {
    console.error('[yakuji/extract]', e)
    return Response.json({ error: e instanceof Error ? e.message : '不明なエラー' }, { status: 500 })
  }
}
