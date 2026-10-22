import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

// 一時的なDBエクスポートエンドポイント（バックアップ取得後は削除すること）
export async function GET() {
  try {
    const dbPath = path.join(process.cwd(), 'data', 'db.json')
    const content = await readFile(dbPath, 'utf-8')
    const data = JSON.parse(content)
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
