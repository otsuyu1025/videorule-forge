'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Video } from '@/types'

type FilterType = 'all' | 'sample' | 'inspection'

export default function VideosPage() {
  const [videos, setVideos] = useState<Video[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', type: 'sample' as 'sample' | 'inspection', url: '' })
  const [submitting, setSubmitting] = useState(false)

  const fetchVideos = () => {
    const url = filter === 'all' ? '/api/videos' : `/api/videos?type=${filter}`
    fetch(url).then(r => r.json()).then(d => { setVideos(d); setLoading(false) })
  }

  useEffect(() => { fetchVideos() }, [filter])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    await fetch('/api/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setForm({ title: '', type: 'sample', url: '' })
    setShowForm(false)
    setSubmitting(false)
    fetchVideos()
  }

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: '未解析', downloading: 'ダウンロード中', analyzing: '解析中', analyzed: '解析済', error: 'エラー',
      extracting_meta: '取得中', extracting_frames: '抽出中',
      running_ocr: 'OCR中', transcribing: '文字起こし中', generating_candidates: '生成中',
    }
    return map[status] || status
  }

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: '#999', downloading: '#FFD803', analyzing: '#FFD803', analyzed: '#BAE8E8', error: '#ff6b6b',
      extracting_meta: '#FFD803', extracting_frames: '#FFD803',
      running_ocr: '#FFD803', transcribing: '#FFD803', generating_candidates: '#FFD803',
    }
    return map[status] || '#999'
  }

  return (
    <div style={{ padding: 40, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#272343', margin: 0 }}>動画一覧</h1>
          <p style={{ color: '#2D334A', marginTop: 8, fontSize: 15 }}>
            お手本動画・検査する動画を管理します。
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            background: '#FFD803',
            color: '#272343',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          + 動画を登録
        </button>
      </div>

      {showForm && (
        <div style={{
          background: '#E3F6F5',
          borderRadius: 12,
          padding: 24,
          marginBottom: 32,
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', marginTop: 0, marginBottom: 20 }}>
            動画を登録
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#272343', marginBottom: 6 }}>
                動画のタイトル
              </label>
              <input
                type="text"
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="例: 春の新商品プロモーション動画"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #BAE8E8', fontSize: 14, background: '#fff', color: '#272343', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#272343', marginBottom: 6 }}>
                動画の種類
              </label>
              <div style={{ display: 'flex', gap: 12 }}>
                {[
                  { value: 'sample', label: 'お手本動画', desc: 'ルールを育てるための動画' },
                  { value: 'inspection', label: '検査する動画', desc: 'ルールで品質を確認する動画' },
                ].map(opt => (
                  <label key={opt.value} style={{
                    flex: 1,
                    border: `2px solid ${form.type === opt.value ? '#272343' : '#BAE8E8'}`,
                    borderRadius: 8,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    background: form.type === opt.value ? '#272343' : '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}>
                    <input
                      type="radio"
                      name="type"
                      value={opt.value}
                      checked={form.type === opt.value}
                      onChange={() => setForm({ ...form, type: opt.value as 'sample' | 'inspection' })}
                      style={{ display: 'none' }}
                    />
                    <span style={{ fontWeight: 700, fontSize: 14, color: form.type === opt.value ? '#FFD803' : '#272343' }}>
                      {opt.label}
                    </span>
                    <span style={{ fontSize: 12, color: form.type === opt.value ? 'rgba(255,255,255,0.75)' : '#2D334A' }}>
                      {opt.desc}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#272343', marginBottom: 6 }}>
                動画URL（任意）
              </label>
              <input
                type="url"
                value={form.url}
                onChange={e => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.com/video.mp4"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #BAE8E8', fontSize: 14, background: '#fff', color: '#272343', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="submit"
                disabled={submitting}
                style={{ background: '#272343', color: '#FFD803', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                {submitting ? '登録中...' : '登録する'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{ background: 'transparent', color: '#2D334A', border: '1px solid #BAE8E8', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}
              >
                キャンセル
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['all', 'sample', 'inspection'] as FilterType[]).map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setLoading(true) }}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: filter === f ? '2px solid #272343' : '1px solid #BAE8E8',
              background: filter === f ? '#272343' : '#fff',
              color: filter === f ? '#FFD803' : '#2D334A',
              fontWeight: filter === f ? 700 : 400,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {{ all: 'すべて', sample: 'お手本動画', inspection: '検査する動画' }[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#2D334A' }}>読み込み中...</div>
      ) : videos.length === 0 ? (
        <div style={{ background: '#E3F6F5', borderRadius: 12, padding: 40, textAlign: 'center', color: '#2D334A' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🎬</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: '#272343' }}>動画がまだありません</div>
          <div style={{ fontSize: 14 }}>「動画を登録」ボタンから登録してください。</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {videos.map(video => (
            <Link key={video.id} href={`/videos/${video.id}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: '#fff',
                border: '1px solid #E3F6F5',
                borderRadius: 12,
                padding: '20px',
                cursor: 'pointer',
                transition: 'border-color 0.1s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: video.type === 'sample' ? '#272343' : '#BAE8E8',
                    color: video.type === 'sample' ? '#FFD803' : '#272343',
                    padding: '3px 10px',
                    borderRadius: 20,
                  }}>
                    {video.type === 'sample' ? 'お手本動画' : '検査する動画'}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: statusColor(video.status),
                    fontWeight: 600,
                  }}>
                    ● {statusLabel(video.status)}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#272343', marginBottom: 8, lineHeight: 1.4 }}>
                  {video.title}
                </div>
                {video.url && (
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {video.url}
                  </div>
                )}
                <div style={{ fontSize: 12, color: '#999' }}>
                  {new Date(video.createdAt).toLocaleDateString('ja-JP')}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
