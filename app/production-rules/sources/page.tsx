'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Video, Guideline } from '@/types'

type FilterType = 'all' | 'sampleVideo' | 'guideline'

type SourceItem =
  | { kind: 'sampleVideo'; data: Video }
  | { kind: 'guideline'; data: Guideline }

function SourceBadge({ kind }: { kind: 'sampleVideo' | 'guideline' }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      background: kind === 'sampleVideo' ? '#272343' : '#E3F6F5',
      color: kind === 'sampleVideo' ? '#FFD803' : '#272343',
      padding: '3px 10px', borderRadius: 20,
    }}>
      {kind === 'sampleVideo' ? 'お手本動画' : 'ガイドライン'}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    pending: { label: '未解析', color: '#999' },
    downloading: { label: 'ダウンロード中', color: '#FFD803' },
    analyzing: { label: '解析中', color: '#FFD803' },
    extracting_meta: { label: '動画情報取得中', color: '#FFD803' },
    extracting_frames: { label: 'フレーム抽出中', color: '#FFD803' },
    running_ocr: { label: 'テキスト読み取り中', color: '#FFD803' },
    transcribing: { label: '音声文字起こし中', color: '#FFD803' },
    generating_candidates: { label: 'ルール候補生成中', color: '#FFD803' },
    analyzed: { label: '解析済', color: '#27ae60' },
    error: { label: 'エラー', color: '#e74c3c' },
  }
  const s = map[status] || { label: status, color: '#999' }
  return (
    <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>● {s.label}</span>
  )
}

export default function SourcesPage() {
  const [items, setItems] = useState<SourceItem[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/videos?type=sample').then(r => r.json()),
      fetch('/api/guidelines').then(r => r.json()),
    ]).then(([videos, guidelines]) => {
      const all: SourceItem[] = [
        ...(videos as Video[]).map(v => ({ kind: 'sampleVideo' as const, data: v })),
        ...(guidelines as Guideline[]).map(g => ({ kind: 'guideline' as const, data: g })),
      ].sort((a, b) => {
        const dateA = a.kind === 'sampleVideo' ? a.data.createdAt : a.data.updatedAt
        const dateB = b.kind === 'sampleVideo' ? b.data.createdAt : b.data.updatedAt
        return new Date(dateB).getTime() - new Date(dateA).getTime()
      })
      setItems(all)
      setLoading(false)
    })
  }, [])

  const filtered = filter === 'all' ? items : items.filter(i => i.kind === filter)

  return (
    <div style={{ padding: 48, maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 4 }}>
        <Link href="/production-rules" style={{ color: '#2D334A', fontSize: 13, textDecoration: 'none', opacity: 0.6 }}>
          ← 動画制作ルール
        </Link>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36, marginTop: 20 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>
            Knowledge Sources
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#272343', margin: 0 }}>知識ソース</h1>
          <p style={{ color: '#2D334A', marginTop: 8, fontSize: 14, lineHeight: 1.7, opacity: 0.8 }}>
            動画制作ルールを育てるための材料です。<br />
            お手本動画とガイドラインを登録します。
          </p>
        </div>
        <Link href="/production-rules/sources/new" style={{
          background: '#FFD803', color: '#272343', border: 'none',
          borderRadius: 8, padding: '11px 20px', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          + 知識ソースを追加
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {(['all', 'sampleVideo', 'guideline'] as FilterType[]).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
            border: filter === f ? '2px solid #272343' : '1px solid #BAE8E8',
            background: filter === f ? '#272343' : '#fff',
            color: filter === f ? '#FFD803' : '#2D334A',
            fontWeight: filter === f ? 700 : 400, fontSize: 13,
          }}>
            {{ all: 'すべて', sampleVideo: 'お手本動画', guideline: 'ガイドライン' }[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#2D334A', opacity: 0.6 }}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#E3F6F5', borderRadius: 14, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>🗂️</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#272343', marginBottom: 8 }}>
            知識ソースがまだありません
          </div>
          <div style={{ fontSize: 14, color: '#2D334A', lineHeight: 1.8, marginBottom: 20, opacity: 0.8 }}>
            お手本動画またはガイドラインを登録してください。<br />
            AIが内容を解析してルール候補を生成します。
          </div>
          <Link href="/production-rules/sources/new" style={{
            background: '#272343', color: '#FFD803', padding: '11px 24px',
            borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14,
            display: 'inline-block',
          }}>
            最初の知識ソースを追加する
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(item => {
            if (item.kind === 'sampleVideo') {
              const v = item.data
              return (
                <Link key={v.id} href={`/videos/${v.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: '#fff', border: '1px solid #E3F6F5', borderRadius: 12,
                    padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16,
                    cursor: 'pointer',
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        <SourceBadge kind="sampleVideo" />
                        <StatusBadge status={v.status} />
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 16, color: '#272343' }}>{v.title}</div>
                      {v.url && <div style={{ fontSize: 12, color: '#999', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.url}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: '#BAE8E8' }}>
                        {new Date(v.createdAt).toLocaleDateString('ja-JP')}
                      </div>
                      <div style={{ color: '#BAE8E8', fontSize: 18, marginTop: 4 }}>→</div>
                    </div>
                  </div>
                </Link>
              )
            }

            const g = item.data
            return (
              <Link key={g.id} href={`/guidelines/${g.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#fff', border: '1px solid #E3F6F5', borderRadius: 12,
                  padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16,
                  cursor: 'pointer',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <SourceBadge kind="guideline" />
                      {g.fileName && (
                        <span style={{ fontSize: 11, color: '#999' }}>
                          {g.fileType?.toUpperCase()} ファイル
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#272343' }}>{g.title}</div>
                    {g.fileName && (
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>📎 {g.fileName}</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: '#BAE8E8' }}>
                      {new Date(g.updatedAt).toLocaleDateString('ja-JP')}
                    </div>
                    <div style={{ color: '#BAE8E8', fontSize: 18, marginTop: 4 }}>→</div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
