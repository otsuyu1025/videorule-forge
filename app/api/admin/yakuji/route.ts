import { NextRequest } from 'next/server'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import type { YakujiSettings } from '@/types'

const YAKUJI_PATH = path.join(process.cwd(), 'data', 'rules', 'yakuji.json')

function readYakuji(): YakujiSettings {
  if (!existsSync(YAKUJI_PATH)) {
    return { enabled: false, rules: [] }
  }
  return JSON.parse(readFileSync(YAKUJI_PATH, 'utf-8')) as YakujiSettings
}

function writeYakuji(data: YakujiSettings): void {
  writeFileSync(YAKUJI_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

export async function GET() {
  return Response.json(readYakuji())
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  const current = readYakuji()
  const updated: YakujiSettings = { ...current, ...body }
  writeYakuji(updated)
  return Response.json(updated)
}
