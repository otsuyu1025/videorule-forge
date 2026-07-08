import { getDb } from '@/lib/db'

export async function GET() {
  const db = await getDb()

  const pendingCandidates = db.data.ruleCandidates.filter(
    c => c.approvalStatus === 'pending' && !c.deletedAt
  ).length

  const pendingInspections = db.data.videoInspections.filter(
    i => i.status === 'running'
  ).length

  const recentRules = db.data.productionRules
    .filter(r => !r.deletedAt && r.isActive)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5)

  const recentReports = db.data.inspectionReports
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
    .map(report => {
      const video = db.data.videos.find(v => v.id === report.videoId)
      return { ...report, videoTitle: video?.title || '不明な動画' }
    })

  const totalRules = db.data.productionRules.filter(r => !r.deletedAt && r.isActive).length
  const totalSources =
    db.data.guidelines.filter(g => !g.deletedAt).length +
    db.data.videos.filter(v => !v.deletedAt && v.type === 'sample').length
  const totalInspections = db.data.videoInspections.filter(i => i.status === 'completed').length

  return Response.json({
    pendingCandidates,
    pendingInspections,
    recentRules,
    recentReports,
    totalRules,
    totalSources,
    totalInspections,
  })
}
