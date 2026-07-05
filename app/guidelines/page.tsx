'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Guideline } from '@/types'

function GuidelineCard({ guideline, onDelete }: { guideline: Guideline; onDelete: () => void }) {
  const preview = guideline.content.split('\n').slice(0, 3).join('\n').trim()
  const hasMore = guideline.content.split('\n').length > 3

  return (
    <div style={{ position: 'relative' }}>
      <Link href={`/guidelines/${guideline.id}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{
          background: '#fff',
          border: '1px solid #E3F6F5',
          borderRadius: 14,
          padding: '24px 28px',
          cursor: 'pointer',
          transition: 'border-color 0.15s, box-shadow 0.15s',
        }}
          onMouseEnter={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = '#BAE8E8'
            el.style.boxShadow = '0 2px 12px rgba(39,35,67,0.06)'
          }}
          onMouseLeave={e => {
            const el = e.currentTarget as HTMLElement
            el.style.borderColor = '#E3F6F5'
            el.style.boxShadow = 'none'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#272343',
                margin: 0,
                marginBottom: 12,
                lineHeight: 1.4,
              }}>
                {guideline.title}
              </h3>
              <p style={{
                fontSize: 14,
                color: '#2D334A',
                lineHeight: 1.8,
                margin: 0,
                whiteSpace: 'pre-wrap',
                opacity: 0.8,
              }}>
                {preview}
                {hasMore && <span style={{ color: '#BAE8E8' }}>{'\n'}…</span>}
              </p>
            </div>
            <div style={{
              marginLeft: 20,
              color: '#BAE8E8',
              fontSize: 20,
              flexShrink: 0,
              alignSelf: 'center',
            }}>
              →
            </div>
          </div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid #F0FAFA',
          }}>
            <span style={{ fontSize: 12, color: '#BAE8E8' }}>
              更新 {new Date(guideline.updatedAt).toLocaleDateString('ja-JP')}
            </span>
            <span style={{
              fontSize: 11,
              color: '#272343',
              background: '#E3F6F5',
              padding: '3px 10px',
              borderRadius: 20,
              fontWeight: 600,
            }}>
              参照中
            </span>
          </div>
        </div>
      </Link>

      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        display: 'flex',
        gap: 6,
        zIndex: 1,
      }}>
        <Link
          href={`/guidelines/${guideline.id}/edit`}
          onClick={e => e.stopPropagation()}
          style={{
            background: '#fff',
            color: '#272343',
            border: '1px solid #E3F6F5',
            borderRadius: 6,
            padding: '5px 12px',
            fontSize: 12,
            cursor: 'pointer',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          編集
        </Link>
        <button
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            onDelete()
          }}
          style={{
            background: '#fff',
            color: '#ff6b6b',
            border: '1px solid #ffd0d0',
            borderRadius: 6,
            padding: '5px 10px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          削除
        </button>
      </div>
    </div>
  )
}

export default function GuidelinesPage() {
  const router = useRouter()
  const [guidelines, setGuidelines] = useState<Guideline[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGuidelines = () => {
    fetch('/api/guidelines').then(r => r.json()).then(d => { setGuidelines(d); setLoading(false) })
  }

  useEffect(() => { fetchGuidelines() }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('このガイドラインを削除しますか？\n一度削除すると元に戻せません。')) return
    await fetch(`/api/guidelines/${id}`, { method: 'DELETE' })
    fetchGuidelines()
  }

  return (
    <div style={{ padding: 48, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>
            Knowledge Base
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 700, color: '#272343', margin: 0, lineHeight: 1.3 }}>
            ガイドライン
          </h1>
          <p style={{ color: '#2D334A', marginTop: 10, fontSize: 15, lineHeight: 1.7, opacity: 0.85 }}>
            AIが動画制作ルールを生成するときに参照する、<br />
            企業の知識ベースです。
          </p>
        </div>
        <Link
          href="/guidelines/new"
          style={{
            background: '#FFD803',
            color: '#272343',
            border: 'none',
            borderRadius: 8,
            padding: '11px 22px',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          + 追加する
        </Link>
      </div>

      {loading ? (
        <div style={{ color: '#2D334A', opacity: 0.6 }}>読み込み中...</div>
      ) : guidelines.length === 0 ? (
        <div style={{
          background: 'linear-gradient(135deg, #E3F6F5 0%, #F5FCFC 100%)',
          borderRadius: 16,
          padding: '56px 40px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📖</div>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 10, color: '#272343' }}>
            ガイドラインがまだありません
          </div>
          <div style={{ fontSize: 14, color: '#2D334A', lineHeight: 1.8, marginBottom: 24, opacity: 0.8 }}>
            ブランドガイドライン、デザインルール、コンプライアンスルールなどを登録すると、<br />
            お手本動画の解析時にAIが自動的に参照し、より精度の高いルール候補を生成します。
          </div>
          <Link
            href="/guidelines/new"
            style={{
              background: '#272343',
              color: '#FFD803',
              padding: '12px 28px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 14,
              display: 'inline-block',
            }}
          >
            最初のガイドラインを追加する
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {guidelines.map(g => (
            <GuidelineCard
              key={g.id}
              guideline={g}
              onDelete={() => handleDelete(g.id)}
            />
          ))}
          <div style={{ marginTop: 8, padding: '16px 20px', background: '#F5FCFC', borderRadius: 10, fontSize: 13, color: '#2D334A', opacity: 0.75, lineHeight: 1.6 }}>
            💡 登録されたガイドラインは、お手本動画の解析時にAIへ自動送信されます。
            内容が充実するほど、ルール候補の精度が上がります。
          </div>
        </div>
      )}
    </div>
  )
}
