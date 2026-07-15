import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { YakujiRule } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

async function extractTextFromUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YakujiBot/1.0)' },
  })
  if (!res.ok) throw new Error(`URL取得失敗: ${res.status} ${res.statusText}`)
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('pdf')) {
    const buf = await res.arrayBuffer()
    return extractTextFromPdfBuffer(Buffer.from(buf))
  }
  const html = await res.text()
  const cleaned = cleanHtml(html)
  console.log(`[yakuji/extract] URL cleaned text length: ${cleaned.length}`)
  // 長い法令テキストは先頭15000字 + 後半5000字を使用（広告規制条文は後半にあることが多い）
  if (cleaned.length <= 20000) return cleaned
  return cleaned.slice(0, 15000) + '\n…（中略）…\n' + cleaned.slice(-5000)
}

async function extractTextFromPdfBuffer(buf: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse')
  const data = await pdfParse(buf)
  const text = (data.text as string).replace(/\s+/g, ' ').trim()
  console.log(`[yakuji/extract] PDF text length: ${text.length}`)
  return text.slice(0, 20000)
}

// tool use でJSONを強制出力させる（パース失敗を防ぐ）
const EXTRACT_TOOL: Anthropic.Tool = {
  name: 'save_yakuji_rules',
  description: '資料から抽出した薬機法の広告判定ルールを保存する',
  input_schema: {
    type: 'object' as const,
    properties: {
      source_name: {
        type: 'string',
        description: '資料名（例: 医薬品等適正広告基準（令和3年8月改正））',
      },
      source_updated_at: {
        type: 'string',
        description: '資料の更新日（YYYY-MM-DD形式）。不明な場合は空文字',
      },
      rules: {
        type: 'array',
        description: '薬機法の広告判定ルール（5〜10件）',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'yakuji_で始まるスネークケースのID' },
            label: { type: 'string', description: '短いカテゴリ名' },
            description: { type: 'string', description: '判定基準の説明（100字以内）' },
            examples_ng: {
              type: 'array',
              items: { type: 'string' },
              description: 'NG表現の例',
            },
            examples_ok: {
              type: 'array',
              items: { type: 'string' },
              description: 'OK表現の例',
            },
          },
          required: ['id', 'label', 'description', 'examples_ng'],
        },
      },
    },
    required: ['source_name', 'rules'],
  },
}

const EXTRACT_PROMPT = (text: string) =>
  `あなたは日本の薬機法（医薬品医療機器等法）の広告規制の専門家です。
以下の資料テキストを解析し、動画広告の薬機法審査に使えるルールを抽出してください。

【資料テキスト】
${text}

資料が法令全文の場合は、第66条（誇大広告等の禁止）、第67条（特定疾病用の医薬品の広告禁止）など広告規制に関連する条文を重点的に参照し、実際の動画広告審査で使えるルールに落とし込んでください。
save_yakuji_rules ツールを呼び出してルールを保存してください。`

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
        rawText = await extractTextFromPdfBuffer(Buffer.from(await file.arrayBuffer()))
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
      return Response.json({ error: 'テキストを抽出できませんでした。PDFをお試しください。' }, { status: 422 })
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content: EXTRACT_PROMPT(rawText) }],
    })

    const toolUse = message.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      // tool useが呼ばれなかった場合はテキストをログして詳細エラーを返す
      const textBlock = message.content.find(b => b.type === 'text')
      const claudeText = textBlock && textBlock.type === 'text' ? textBlock.text : ''
      console.error('[yakuji/extract] tool use not called. Claude text:', claudeText.slice(0, 500))
      return Response.json({
        error: `AIがルールを抽出できませんでした。資料に薬機法の広告規制内容が含まれているか確認してください。（推奨: 厚生労働省「医薬品等適正広告基準」のPDF）`,
      }, { status: 422 })
    }

    const input = toolUse.input as {
      source_name: string
      source_updated_at?: string
      rules: YakujiRule[]
    }

    return Response.json({
      source_name: input.source_name,
      source_updated_at: input.source_updated_at || null,
      rules: input.rules,
    })
  } catch (e) {
    console.error('[yakuji/extract]', e)
    return Response.json({ error: e instanceof Error ? e.message : '不明なエラー' }, { status: 500 })
  }
}
