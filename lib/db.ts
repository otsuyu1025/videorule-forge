import { JSONFilePreset } from 'lowdb/node'
import { writeFile, copyFile, access } from 'fs/promises'
import path from 'path'
import type { DbSchema } from '@/types'

const defaultData: DbSchema = {
  videos: [],
  videoFeatures: [],
  productionRules: [],
  ruleCandidates: [],
  videoInspections: [],
  inspectionReports: [],
  guidelines: [],
  settings: {},
}

const dbPath = path.join(process.cwd(), 'data', 'db.json')
const dbBackupPath = path.join(process.cwd(), 'data', 'db.backup.json')

let dbInstance: Awaited<ReturnType<typeof JSONFilePreset<DbSchema>>> | null = null

/** ホットリロード後に強制再読み込みさせるためのリセット */
export function resetDbInstance() {
  dbInstance = null
}

export async function getDb() {
  if (!dbInstance) {
    try {
      dbInstance = await JSONFilePreset<DbSchema>(dbPath, defaultData)
    } catch (e) {
      if (e instanceof SyntaxError) {
        // db.json が破損している（空ファイル・不完全なJSON）
        console.error('[db] db.json が破損しています。バックアップを作成して再初期化します。')

        // 壊れたファイルをバックアップとして保存
        try {
          const fileExists = await access(dbPath).then(() => true).catch(() => false)
          if (fileExists) {
            await copyFile(dbPath, dbBackupPath)
            console.error('[db] 破損ファイルを data/db.backup.json に保存しました')
          }
        } catch {
          // バックアップ失敗は無視して初期化を続行
        }

        // 空のデータベースで再初期化
        await writeFile(dbPath, JSON.stringify(defaultData, null, 2))
        dbInstance = await JSONFilePreset<DbSchema>(dbPath, defaultData)
        console.error('[db] 再初期化完了。動画・ルールデータは失われました。')
      } else {
        throw e
      }
    }
  }
  return dbInstance
}

/** db.json の破損リスクを減らすためのラッパー（書き込み前にバックアップ） */
export async function safeWrite(
  db: Awaited<ReturnType<typeof JSONFilePreset<DbSchema>>>
): Promise<void> {
  try {
    await db.write()
  } catch (e) {
    console.error('[db] 書き込みエラー:', e)
    throw e
  }
}
