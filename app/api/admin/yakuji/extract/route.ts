import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import type { YakujiRule } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
            source_article: { type: 'string', description: '引用元の章・条（例: 第十章第六十六条）。不明な場合は「不明」' },
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

資料が法令全文の場合は誇大広告・虚偽広告の禁止に関する条文を重点的に参照し、
実際の広告審査で使えるルールに落とし込んでください。
save_yakuji_rules ツールを呼び出してルールを保存してください。`

async function callClaude(rawText: string) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    tools: [EXTRACT_TOOL],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: EXTRACT_PROMPT(rawText.slice(0, 20000)) }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    const textBlock = message.content.find(b => b.type === 'text')
    const claudeText = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    console.error('[yakuji/extract] tool use not called. Claude text:', claudeText.slice(0, 500))
    return null
  }
  return toolUse.input as {
    source_name: string
    source_updated_at?: string
    rules: YakujiRule[]
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const textOnly = searchParams.get('textOnly') === 'true'

    const contentType = request.headers.get('content-type') || ''
    let rawText = ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const pdfFile = form.get('pdf') as File | null
      const txtFile = form.get('file') as File | null

      if (pdfFile) {
        rawText = await extractTextFromPdfBuffer(Buffer.from(await pdfFile.arrayBuffer()))
      } else if (txtFile) {
        rawText = (await txtFile.text()).slice(0, 20000)
      } else {
        return Response.json({ error: 'ファイルが必要です' }, { status: 400 })
      }
    } else {
      const body = await request.json()
      if (typeof body.text === 'string' && body.text.trim()) {
        rawText = body.text.trim()
      } else {
        return Response.json({ error: 'text フィールドが必要です' }, { status: 400 })
      }
    }

    if (!rawText.trim()) {
      return Response.json({ error: 'テキストを抽出できませんでした' }, { status: 422 })
    }

    // textOnly=true の場合は Claude を呼ばずにテキストだけ返す
    if (textOnly) {
      return Response.json({ text: rawText })
    }

    const result = await callClaude(rawText)
    if (!result) {
      return Response.json({
        error: 'AIがルールを抽出できませんでした。資料に薬機法の広告規制内容が含まれているか確認してください。',
      }, { status: 422 })
    }

    return Response.json({
      source_name: result.source_name,
      source_updated_at: result.source_updated_at || null,
      rules: result.rules,
    })
  } catch (e) {
    console.error('[yakuji/extract]', e)
    return Response.json({ error: e instanceof Error ? e.message : '不明なエラー' }, { status: 500 })
  }
}
