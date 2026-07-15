import { NextRequest } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { getDb } from '@/lib/db'
import type { YakujiSettings } from '@/types'

const YAKUJI_PATH = path.join(process.cwd(), 'data', 'rules', 'yakuji.json')

type YakujiRules = Omit<YakujiSettings, 'enabled'>

function readYakujiRules(): YakujiRules {
  if (!existsSync(YAKUJI_PATH)) return { rules: [] }
  try {
    const raw = JSON.parse(readFileSync(YAKUJI_PATH, 'utf-8'))
    const { enabled: _omit, ...rest } = raw
    return rest as YakujiRules
  } catch {
    return { rules: [] }
  }
}

function writeYakujiRules(data: YakujiRules): void {
  const dir = path.dirname(YAKUJI_PATH)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(YAKUJI_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export async function GET() {
  const db = await getDb()
  const enabled = !!(db.data.settings as Record<string, unknown>)?.yakujiEnabled
  const rules = readYakujiRules()
  return Response.json({ enabled, ...rules })
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const db = await getDb()

  // enabled フラグは db.json に保存（Railway Volume の settings と同じ場所）
  if ('enabled' in body) {
    if (!db.data.settings) db.data.settings = {}
    ;(db.data.settings as Record<string, unknown>).yakujiEnabled = body.enabled
    await db.write()
  }

  // 個別ルールのON/OFF（{ ruleId: string, ruleEnabled: boolean }）
  if ('ruleId' in body && 'ruleEnabled' in body) {
    const current = readYakujiRules()
    writeYakujiRules({
      ...current,
      rules: current.rules.map(r =>
        r.id === body.ruleId ? { ...r, enabled: body.ruleEnabled } : r
      ),
    })
  }

  // 個別ルールの編集（{ ruleId: string, ruleData: Partial<YakujiRule> }）
  if ('ruleId' in body && 'ruleData' in body) {
    const current = readYakujiRules()
    writeYakujiRules({
      ...current,
      rules: current.rules.map(r =>
        r.id === body.ruleId ? { ...r, ...body.ruleData } : r
      ),
    })
  }

  // ルール・資料情報は yakuji.json に保存
  const ruleKeys = ['source_name', 'source_updated_at', 'source_url', 'imported_at', 'rules']
  if (ruleKeys.some(k => k in body)) {
    const current = readYakujiRules()
    const updated: YakujiRules = { ...current }
    for (const k of ruleKeys) {
      if (k in body) (updated as Record<string, unknown>)[k] = body[k]
    }
    writeYakujiRules(updated)
  }

  const enabled = !!(db.data.settings as Record<string, unknown>)?.yakujiEnabled
  return Response.json({ enabled, ...readYakujiRules() })
}

export async function DELETE(request: NextRequest) {
  const { ruleId } = await request.json()
  if (!ruleId) return Response.json({ error: 'ruleId が必要です' }, { status: 400 })
  const current = readYakujiRules()
  writeYakujiRules({
    ...current,
    rules: current.rules.filter(r => r.id !== ruleId),
  })
  const db = await getDb()
  const enabled = !!(db.data.settings as Record<string, unknown>)?.yakujiEnabled
  return Response.json({ enabled, ...readYakujiRules() })
}
