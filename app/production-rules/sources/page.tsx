'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Video, Guideline } from '@/types'

type FilterType = 'all' | 'sampleVideo' | 'guideline' | 'yakuji'

type SourceItem =
  | { kind: 'sampleVideo'; data: Video }
  | { kind: 'guideline'; data: Guideline }

const IN_PROGRESS_STATUSES = [
  'downloading', 'extracting_meta', 'extracting_frames',
  'running_ocr', 'transcribing', 'generating_candidates', 'analyzing',
]

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
    awaiting_review: { label: 'OCR確認待ち', color: '#f39c12' },
    generating_candidates: { label: 'ルール候補生成中', color: '#FFD803' },
    analyzed: { label: '解析完了', color: '#27ae60' },
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
  const [yakujiEnabled, setYakujiEnabled] = useState(false)
  const [sampleVideoEnabled, setSampleVideoEnabled] = useState(false)
  const [yakujiSettings, setYakujiSettings] = useState<{
    enabled: boolean; source_name?: string; source_updated_at?: string; imported_at?: string; rules: unknown[]
  } | null>(null)

  const [guidCandCounts, setGuidCandCounts] = useState<Record<string, number>>({})

  const buildItems = (videos: Video[], guidelines: Guideline[]): SourceItem[] =>
    [
      ...(videos as Video[]).map(v => ({ kind: 'sampleVideo' as const, data: v })),
      ...(guidelines as Guideline[]).map(g => ({ kind: 'guideline' as const, data: g })),
    ].sort((a, b) => {
      const dateA = a.kind === 'sampleVideo' ? a.data.createdAt : a.data.updatedAt
      const dateB = b.kind === 'sampleVideo' ? b.data.createdAt : b.data.updatedAt
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })

  const fetchAll = async () => {
    const [videos, guidelines, candidates, yakuji, features] = await Promise.all([
      fetch('/api/videos?type=sample').then(r => r.json()),
      fetch('/api/guidelines').then(r => r.json()),
      fetch('/api/rule-candidates').then(r => r.json()),
      fetch('/api/admin/yakuji').then(r => r.json()),
      fetch('/api/features').then(r => r.json()),
    ])
    setYakujiEnabled(yakuji.enabled ?? false)
    setYakujiSettings(yakuji)
    setSampleVideoEnabled(features.sampleVideoEnabled === true)
    const counts: Record<string, number> = {}
    for (const c of candidates) {
      if (c.guidelineId) counts[c.guidelineId] = (counts[c.guidelineId] || 0) + 1
    }
    setGuidCandCounts(counts)
    setItems(buildItems(videos, guidelines))
  }

  useEffect(() => {
    fetchAll().then(() => setLoading(false))
  }, [])

  // 解析中の動画がある間は5秒ごとにステータスを再取得
  useEffect(() => {
    const hasInProgress = items.some(
      item => item.kind === 'sampleVideo' && IN_PROGRESS_STATUSES.includes(item.data.status)
    )
    if (!hasInProgress) return
    const interval = setInterval(fetchAll, 5000)
    return () => clearInterval(interval)
  }, [items])

  const filtered = filter === 'all' ? items : items.filter(i => i.kind === filter)

  return (
    <div style={{ padding: 48, maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 4 }}>
        <Link href="/production-rules" style={{ color: '#2D334A', fontSize: 13, textDecoration: 'none', opacity: 0.6 }}>
          ← 検品ルール
        </Link>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36, marginTop: 20 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>
            Knowledge Sources
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#272343', margin: 0 }}>ガイドライン登録</h1>
          <p style={{ color: '#2D334A', marginTop: 8, fontSize: 14, lineHeight: 1.7, opacity: 0.8 }}>
            デザインガイドラインやコンプライアンスルールなどから動画の検品ルールを作成します。
          </p>
        </div>
        <Link href="/production-rules/sources/new" style={{
          background: '#FFD803', color: '#272343', border: 'none',
          borderRadius: 8, padding: '11px 20px', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', textDecoration: 'none', whiteSpace: 'nowrap',
        }}>
          + ガイドラインを追加
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {(['all', 'guideline'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
            border: filter === f ? '2px solid #272343' : '1px solid #BAE8E8',
            background: filter === f ? '#272343' : '#fff',
            color: filter === f ? '#FFD803' : '#2D334A',
            fontWeight: filter === f ? 700 : 400, fontSize: 13,
          }}>
            {f === 'all' ? 'すべて' : 'ガイドライン'}
          </button>
        ))}
        {yakujiEnabled && (
          <button onClick={() => setFilter('yakuji')} style={{
            padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
            border: filter === 'yakuji' ? '2px solid #272343' : '1px solid #BAE8E8',
            background: filter === 'yakuji' ? '#272343' : '#fff',
            color: filter === 'yakuji' ? '#FFD803' : '#2D334A',
            fontWeight: filter === 'yakuji' ? 700 : 400, fontSize: 13,
          }}>
            薬機法
          </button>
        )}
        {sampleVideoEnabled && (
          <button onClick={() => setFilter('sampleVideo')} style={{
            padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
            border: filter === 'sampleVideo' ? '2px solid #272343' : '1px solid #BAE8E8',
            background: filter === 'sampleVideo' ? '#272343' : '#fff',
            color: filter === 'sampleVideo' ? '#FFD803' : '#2D334A',
            fontWeight: filter === 'sampleVideo' ? 700 : 400, fontSize: 13,
          }}>
            お手本動画
          </button>
        )}
      </div>

      {/* 薬機法表示（'all' または 'yakuji' フィルター時） */}
      {!loading && yakujiEnabled && (filter === 'all' || filter === 'yakuji') && (
        <div style={{ marginBottom: filter === 'all' ? 12 : 0 }}>
          {yakujiSettings && (yakujiSettings.rules?.length ?? 0) > 0 ? (
            <div style={{
              background: '#f0faf5', border: '1px solid #27ae60',
              borderRadius: 12, padding: '18px 22px',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, background: '#E3F6F5', color: '#272343', padding: '3px 10px', borderRadius: 20 }}>薬機法</span>
                  <span style={{ fontSize: 12, color: '#27ae60', fontWeight: 600 }}>● 登録済み</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 16, color: '#272343' }}>
                  {yakujiSettings.source_name ?? '医薬品等適正広告基準'}
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  判定ルール: {yakujiSettings.rules.length} カテゴリ
                  {yakujiSettings.source_updated_at && (
                    <span style={{ marginLeft: 12 }}>
                      資料更新日: {new Date(yakujiSettings.source_updated_at).toLocaleDateString('ja-JP')}
                    </span>
                  )}
                </div>
              </div>
              <Link href="/production-rules/yakuji" style={{
                background: '#272343', color: '#FFD803',
                padding: '8px 16px', borderRadius: 8,
                textDecoration: 'none', fontWeight: 700, fontSize: 13,
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>
                編集する
              </Link>
            </div>
          ) : filter === 'yakuji' ? (
            <div style={{ background: '#E3F6F5', borderRadius: 14, padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>⚖️</div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#272343', marginBottom: 8 }}>
                薬機法ルールが未登録です
              </div>
              <div style={{ fontSize: 14, color: '#2D334A', lineHeight: 1.8, marginBottom: 20, opacity: 0.8 }}>
                薬機法の広告規制資料をアップロードすると、<br />
                AIが自動的に判定ルールを抽出します。
              </div>
              <Link href="/production-rules/yakuji" style={{
                background: '#272343', color: '#FFD803', padding: '11px 24px',
                borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14,
                display: 'inline-block',
              }}>
                薬機法をアップロードする
              </Link>
            </div>
          ) : null}
        </div>
      )}

      {loading ? (
        <div style={{ color: '#2D334A', opacity: 0.6 }}>読み込み中...</div>
      ) : filter !== 'yakuji' && filtered.length === 0 ? (
        <div style={{ background: '#E3F6F5', borderRadius: 14, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>🗂️</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#272343', marginBottom: 8 }}>
            ガイドラインがまだありません
          </div>
          <div style={{ fontSize: 14, color: '#2D334A', lineHeight: 1.8, marginBottom: 20, opacity: 0.8 }}>
            ガイドラインなどを登録してください。<br />
            AIが内容を解析してルール候補を生成します。
          </div>
          <Link href="/production-rules/sources/new" style={{
            background: '#272343', color: '#FFD803', padding: '11px 24px',
            borderRadius: 8, textDecoration: 'none', fontWeight: 700, fontSize: 14,
            display: 'inline-block',
          }}>
            最初のガイドラインを追加する
          </Link>
        </div>
      ) : filter !== 'yakuji' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(item => {
            if (item.kind === 'sampleVideo') {
              const v = item.data
              const isAnalyzed = v.status === 'analyzed'
              const cardInner = (
                <div style={{
                  background: isAnalyzed ? '#f0faf5' : '#fff',
                  border: isAnalyzed ? '1px solid #27ae60' : '1px solid #E3F6F5',
                  borderRadius: 12, padding: '18px 22px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  cursor: isAnalyzed ? 'default' : 'pointer',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <SourceBadge kind="sampleVideo" />
                      <StatusBadge status={v.status} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 16, color: '#272343' }}>{v.title}</div>
                    {v.url && <div style={{ fontSize: 12, color: '#999', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.url}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {isAnalyzed ? (
                      <>
                        <Link
                          href={`/videos/${v.id}`}
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 12, color: '#999', textDecoration: 'none', whiteSpace: 'nowrap' }}
                        >
                          詳細
                        </Link>
                        <Link
                          href="/production-rules/candidates"
                          onClick={e => e.stopPropagation()}
                          style={{
                            background: '#272343', color: '#FFD803',
                            padding: '8px 16px', borderRadius: 8,
                            textDecoration: 'none', fontWeight: 700, fontSize: 13,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          ルール候補を確認 →
                        </Link>
                      </>
                    ) : (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: '#BAE8E8' }}>
                          {new Date(v.createdAt).toLocaleDateString('ja-JP')}
                        </div>
                        <div style={{ color: '#BAE8E8', fontSize: 18, marginTop: 4 }}>→</div>
                      </div>
                    )}
                  </div>
                </div>
              )
              return isAnalyzed
                ? <div key={v.id}>{cardInner}</div>
                : <Link key={v.id} href={`/videos/${v.id}`} style={{ textDecoration: 'none' }}>{cardInner}</Link>
            }

            const g = item.data
            const gCount = guidCandCounts[g.id] ?? 0
            const gAnalyzed = gCount > 0
            const gCardInner = (
              <div style={{
                background: gAnalyzed ? '#f0faf5' : '#fff',
                border: gAnalyzed ? '1px solid #27ae60' : '1px solid #E3F6F5',
                borderRadius: 12, padding: '18px 22px',
                display: 'flex', alignItems: 'center', gap: 16,
                cursor: gAnalyzed ? 'default' : 'pointer',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <SourceBadge kind="guideline" />
                    {gAnalyzed
                      ? <span style={{ fontSize: 12, color: '#27ae60', fontWeight: 600 }}>● 解析完了</span>
                      : g.fileName && <span style={{ fontSize: 11, color: '#999' }}>{g.fileType?.toUpperCase()} ファイル</span>
                    }
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 16, color: '#272343' }}>{g.title}</div>
                  {g.fileName && (
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>📎 {g.fileName}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {gAnalyzed ? (
                    <>
                      <Link
                        href={`/guidelines/${g.id}`}
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize: 12, color: '#999', textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        詳細
                      </Link>
                      <Link
                        href="/production-rules/candidates"
                        onClick={e => e.stopPropagation()}
                        style={{
                          background: '#272343', color: '#FFD803',
                          padding: '8px 16px', borderRadius: 8,
                          textDecoration: 'none', fontWeight: 700, fontSize: 13,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        ルール候補を確認 →
                      </Link>
                    </>
                  ) : (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 11, color: '#BAE8E8' }}>
                        {new Date(g.updatedAt).toLocaleDateString('ja-JP')}
                      </div>
                      <div style={{ color: '#BAE8E8', fontSize: 18, marginTop: 4 }}>→</div>
                    </div>
                  )}
                </div>
              </div>
            )
            return gAnalyzed
              ? <div key={g.id}>{gCardInner}</div>
              : <Link key={g.id} href={`/guidelines/${g.id}`} style={{ textDecoration: 'none' }}>{gCardInner}</Link>
          })}
        </div>
      ) : null}
    </div>
  )
}
