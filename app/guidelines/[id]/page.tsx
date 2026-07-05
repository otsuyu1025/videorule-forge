'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Guideline } from '@/types'

export default function GuidelineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [guideline, setGuideline] = useState<Guideline | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/guidelines')
      .then(r => r.json())
      .then((list: Guideline[]) => {
        const found = list.find(g => g.id === id)
        setGuideline(found || null)
        setLoading(false)
      })
  }, [id])

  const handleDelete = async () => {
    if (!confirm('このガイドラインを削除しますか？\n一度削除すると元に戻せません。')) return
    await fetch(`/api/guidelines/${id}`, { method: 'DELETE' })
    router.push('/guidelines')
  }

  if (loading) return (
    <div style={{ padding: 48, color: '#2D334A', opacity: 0.6 }}>読み込み中...</div>
  )

  if (!guideline) return (
    <div style={{ padding: 48 }}>
      <Link href="/production-rules/sources" style={{ color: '#272343', fontSize: 13, textDecoration: 'none' }}>← 知識ソースへ戻る</Link>
      <div style={{ marginTop: 32, color: '#2D334A' }}>ガイドラインが見つかりません。</div>
    </div>
  )

  const lines = guideline.content.split('\n')

  return (
    <div style={{ padding: 48, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/production-rules/sources" style={{ color: '#2D334A', fontSize: 13, textDecoration: 'none', opacity: 0.6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          ← 知識ソースへ戻る
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
            Guideline
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#272343', margin: 0, lineHeight: 1.3 }}>
            {guideline.title}
          </h1>
          <div style={{ fontSize: 12, color: '#BAE8E8', marginTop: 12 }}>
            最終更新: {new Date(guideline.updatedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 24, flexShrink: 0 }}>
          <Link
            href={`/guidelines/${id}/edit`}
            style={{
              background: '#FFD803',
              color: '#272343',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
              textDecoration: 'none',
            }}
          >
            編集する
          </Link>
          <button
            onClick={handleDelete}
            style={{
              background: 'transparent',
              color: '#ff6b6b',
              border: '1px solid #ffd0d0',
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            削除
          </button>
        </div>
      </div>

      <div style={{
        background: '#fff',
        border: '1px solid #E3F6F5',
        borderRadius: 16,
        padding: '36px 40px',
        lineHeight: 1.9,
      }}>
        {lines.map((line, i) => {
          if (line.trim() === '') return <div key={i} style={{ height: 12 }} />

          const isBullet = /^[・•\-]/.test(line.trim())
          const isHeading = /^#+\s/.test(line.trim()) || (line.trim().endsWith('：') || line.trim().endsWith(':'))

          if (isHeading && !isBullet) {
            return (
              <div key={i} style={{
                fontSize: 14,
                fontWeight: 700,
                color: '#272343',
                marginTop: i > 0 ? 24 : 0,
                marginBottom: 8,
                paddingBottom: 6,
                borderBottom: '1px solid #E3F6F5',
              }}>
                {line}
              </div>
            )
          }

          if (isBullet) {
            return (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span style={{ color: '#BAE8E8', flexShrink: 0, marginTop: 2 }}>▸</span>
                <span style={{ fontSize: 15, color: '#2D334A' }}>{line.replace(/^[・•\-]\s*/, '')}</span>
              </div>
            )
          }

          return (
            <p key={i} style={{
              fontSize: 15,
              color: '#2D334A',
              margin: 0,
              marginBottom: 4,
            }}>
              {line}
            </p>
          )
        })}
      </div>

      <div style={{
        marginTop: 24,
        padding: '16px 20px',
        background: '#F5FCFC',
        borderRadius: 10,
        fontSize: 13,
        color: '#2D334A',
        opacity: 0.75,
        lineHeight: 1.6,
      }}>
        💡 このガイドラインは、お手本動画を解析するたびにAIへ自動的に送信されます。
      </div>
    </div>
  )
}
