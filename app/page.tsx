'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface DashboardData {
  pendingCandidates: number
  pendingInspections: number
  totalRules: number
  totalVideos: number
  totalInspections: number
  recentRules: Array<{ id: string; content: string; category: string; updatedAt: string }>
  recentReports: Array<{ id: string; videoTitle: string; comments: string; createdAt: string; issues: unknown[] }>
}

function StatCard({ label, value, href, color }: { label: string; value: number; href: string; color: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#fff',
        border: `2px solid ${color}`,
        borderRadius: 12,
        padding: '20px 24px',
        cursor: 'pointer',
        transition: 'transform 0.1s',
      }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#272343' }}>{value}</div>
        <div style={{ fontSize: 13, color: '#2D334A', marginTop: 4 }}>{label}</div>
      </div>
    </Link>
  )
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ padding: 48, color: '#2D334A' }}>読み込み中...</div>
  )

  return (
    <div style={{ padding: 40, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#272343', margin: 0 }}>
          ダッシュボード
        </h1>
        <p style={{ color: '#2D334A', marginTop: 8, fontSize: 15, minHeight: 24 }}>
        </p>
      </div>

      {(data?.pendingCandidates ?? 0) > 0 && (
        <div style={{
          background: '#FFD803',
          borderRadius: 10,
          padding: '14px 20px',
          marginBottom: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div>
            <div style={{ fontWeight: 600, color: '#272343' }}>
              承認待ちのルール候補が {data!.pendingCandidates} 件あります
            </div>
            <div style={{ fontSize: 13, color: '#2D334A' }}>
              <Link href="/production-rules" style={{ color: '#272343', fontWeight: 600 }}>
                動画制作ルールページ
              </Link>
              で確認・承認してください。
            </div>
          </div>
        </div>
      )}

      <div className="grid-stats">
        <StatCard label="動画制作ルール" value={data?.totalRules ?? 0} href="/production-rules" color="#BAE8E8" />
        <StatCard label="知識ソース" value={data?.totalVideos ?? 0} href="/production-rules/sources" color="#E3F6F5" />
        <StatCard label="完了した検査" value={data?.totalInspections ?? 0} href="/inspections" color="#FFD803" />
      </div>

      <div className="grid-two-col">
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', margin: 0 }}>最近の動画制作ルール</h2>
            <Link href="/production-rules" style={{ fontSize: 13, color: '#272343', textDecoration: 'none', fontWeight: 600 }}>
              すべて見る →
            </Link>
          </div>
          {(data?.recentRules.length ?? 0) === 0 ? (
            <div style={{ background: '#E3F6F5', borderRadius: 10, padding: 20, color: '#2D334A', fontSize: 14 }}>
              まだルールがありません。<br />
              <Link href="/production-rules/sources" style={{ color: '#272343', fontWeight: 600 }}>知識ソースを登録</Link>してルールを育てましょう。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data!.recentRules.map(rule => (
                <div key={rule.id} style={{
                  background: '#fff',
                  border: '1px solid #E3F6F5',
                  borderRadius: 8,
                  padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 12, color: '#BAE8E8', fontWeight: 700, background: '#272343', display: 'inline-block', padding: '2px 8px', borderRadius: 4, marginBottom: 6 }}>
                    {rule.category}
                  </div>
                  <div style={{ fontSize: 14, color: '#272343', lineHeight: 1.5 }}>{rule.content}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', margin: 0 }}>最近の検査レポート</h2>
            <Link href="/inspections" style={{ fontSize: 13, color: '#272343', textDecoration: 'none', fontWeight: 600 }}>
              すべて見る →
            </Link>
          </div>
          {(data?.recentReports.length ?? 0) === 0 ? (
            <div style={{ background: '#E3F6F5', borderRadius: 10, padding: 20, color: '#2D334A', fontSize: 14 }}>
              まだ検査レポートがありません。<br />
              <Link href="/inspections" style={{ color: '#272343', fontWeight: 600 }}>動画検品</Link>から検査を実行しましょう。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data!.recentReports.map(report => (
                <div key={report.id} style={{
                  background: '#fff',
                  border: '1px solid #E3F6F5',
                  borderRadius: 8,
                  padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#272343' }}>{report.videoTitle}</div>
                  <div style={{ fontSize: 12, color: '#2D334A', marginTop: 4 }}>{report.comments}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 6 }}>
                    {new Date(report.createdAt).toLocaleDateString('ja-JP')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <div style={{
        marginTop: 40,
        background: '#272343',
        borderRadius: 12,
        padding: '24px 28px',
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: '#FFD803', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            📋 知識ソースを登録して、ルールを育てる
          </div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
            お手本動画やガイドラインを登録すると、AIがルール候補を提案します。
          </div>
        </div>
        <Link href="/production-rules/sources/new" style={{
          background: '#FFD803',
          color: '#272343',
          fontWeight: 700,
          padding: '10px 20px',
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: 14,
          whiteSpace: 'nowrap',
        }}>
          動画を登録 →
        </Link>
      </div>
    </div>
  )
}
