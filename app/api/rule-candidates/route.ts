import { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  const db = await getDb()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const videoId = searchParams.get('videoId')
  const guidelineId = searchParams.get('guidelineId')

  let candidates = db.data.ruleCandidates.filter(c => !c.deletedAt)
  if (status) candidates = candidates.filter(c => c.approvalStatus === status)
  if (videoId) candidates = candidates.filter(c => c.videoId === videoId)
  if (guidelineId) candidates = candidates.filter(c => c.guidelineId === guidelineId)
  candidates = candidates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return Response.json(candidates)
}
