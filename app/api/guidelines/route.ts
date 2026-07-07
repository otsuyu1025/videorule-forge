import { NextRequest } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import type { Guideline } from '@/types'

async function extractText(buffer: Buffer, ext: string): Promise<string> {
  if (ext === 'txt') {
    return buffer.toString('utf-8')
  }
  if (ext === 'pdf') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfModule = await import('pdf-parse') as any
    const pdfParse = pdfModule.default ?? pdfModule
    const result = await pdfParse(buffer)
    return result.text
  }
  if (ext === 'docx' || ext === 'doc') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }
  return ''
}

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

    const buffer = Buffer.from(await file.arrayBuffer())
    let content = ''
    try {
      content = await extractText(buffer, fileExt)
    } catch (e) {
      console.error('[guideline] テキスト抽出失敗:', e)
    }

    const uploadsDir = path.join(process.cwd(), 'data', 'uploads')
    await mkdir(uploadsDir, { recursive: true })
    const savedName = `${uuidv4()}-${fileName}`
    const filePath = path.join(uploadsDir, savedName)
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
