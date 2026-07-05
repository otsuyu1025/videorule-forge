import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(request.url)
  const videoId = searchParams.get('videoId')

  let reports = db.data.inspectionReports
  if (videoId) reports = reports.filter(r => r.videoId === videoId)
  reports = reports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return Response.json(reports)
}
