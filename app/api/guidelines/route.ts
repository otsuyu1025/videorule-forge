import { NextRequest } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import type { Guideline } from '@/types'

export async function GET() {
  const db = await getDb()
  const guidelines = db.data.guidelines.filter(g => !g.deletedAt)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  return Response.json(guidelines)
}

export async function POST(request: NextRequest) {
  const db = await getDb()
  const contentType = request.headers.get('content-type') || ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const titleField = formData.get('title') as string | null

    if (!file) return Response.json({ error: 'ファイルが選択されていません' }, { status: 400 })

    const fileName = file.name
    const fileExt = fileName.split('.').pop()?.toLowerCase() ?? ''
    const title = titleField?.trim() || fileName.replace(/\.[^.]+$/, '')

    let content = ''
    if (fileExt === 'txt') {
      content = await file.text()
    }

    const uploadsDir = path.join(process.cwd(), 'data', 'uploads')
    await mkdir(uploadsDir, { recursive: true })
    const savedName = `${uuidv4()}-${fileName}`
    const filePath = path.join(uploadsDir, savedName)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(filePath, buffer)

    const guideline: Guideline = {
      id: uuidv4(),
      title,
      content,
      fileName,
      fileType: fileExt,
      updatedAt: new Date().toISOString(),
    }

    db.data.guidelines.push(guideline)
    await db.write()
    return Response.json(guideline, { status: 201 })
  }

  const body = await request.json()
  const guideline: Guideline = {
    id: uuidv4(),
    title: body.title,
    content: body.content ?? '',
    updatedAt: new Date().toISOString(),
  }
  db.data.guidelines.push(guideline)
  await db.write()
  return Response.json(guideline, { status: 201 })
}
