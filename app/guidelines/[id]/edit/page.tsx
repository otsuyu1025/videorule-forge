'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Guideline } from '@/types'

export default function GuidelineEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [form, setForm] = useState({ title: '', content: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/guidelines')
      .then(r => r.json())
      .then((list: Guideline[]) => {
        const found = list.find(g => g.id === id)
        if (found) setForm({ title: found.title, content: found.content })
        setLoading(false)
      })
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await fetch(`/api/guidelines/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    router.push(`/guidelines/${id}`)
  }

  if (loading) return (
    <div style={{ padding: 48, color: '#2D334A', opacity: 0.6 }}>読み込み中...</div>
  )

  return (
    <div style={{ padding: 48, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <Link href={`/guidelines/${id}`} style={{ color: '#2D334A', fontSize: 13, textDecoration: 'none', opacity: 0.6 }}>
          ← 詳細に戻る
        </Link>
      </div>

      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
          Editing
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#272343', margin: 0 }}>
          ガイドラインを編集
        </h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{
          background: '#fff',
          border: '1px solid #E3F6F5',
          borderRadius: 16,
          padding: '32px 36px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 8, letterSpacing: '0.02em' }}>
              タイトル
            </label>
            <input
              required
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="例: ブランドカラーガイドライン"
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 8,
                border: '1px solid #E3F6F5',
                fontSize: 16,
                fontWeight: 600,
                color: '#272343',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = '#BAE8E8' }}
              onBlur={e => { e.target.style.borderColor = '#E3F6F5' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 8, letterSpacing: '0.02em' }}>
              内容
            </label>
            <div style={{ fontSize: 12, color: '#2D334A', opacity: 0.6, marginBottom: 10, lineHeight: 1.6 }}>
              箇条書き（・ で始まる行）や見出し（行末が「：」の行）は、詳細画面で整形して表示されます。
            </div>
            <textarea
              required
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              rows={16}
              placeholder={'ブランドカラー：\n・プライマリカラーは #272343（ダークネイビー）\n・アクセントカラーは #FFD803（イエロー）\n\nロゴの扱い：\n・ロゴは必ず右下に配置する\n・背景色が暗い場合は白抜きバージョンを使用する'}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: 8,
                border: '1px solid #E3F6F5',
                fontSize: 14,
                color: '#2D334A',
                resize: 'vertical',
                boxSizing: 'border-box',
                lineHeight: 1.9,
                fontFamily: 'inherit',
                outline: 'none',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = '#BAE8E8' }}
              onBlur={e => { e.target.style.borderColor = '#E3F6F5' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: saving ? '#ccc' : '#272343',
              color: '#FFD803',
              border: 'none',
              borderRadius: 8,
              padding: '12px 28px',
              fontWeight: 700,
              fontSize: 15,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? '保存中...' : '保存する'}
          </button>
          <Link
            href={`/guidelines/${id}`}
            style={{
              background: 'transparent',
              color: '#2D334A',
              border: '1px solid #E3F6F5',
              borderRadius: 8,
              padding: '12px 20px',
              fontSize: 14,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            キャンセル
          </Link>
        </div>
      </form>
    </div>
  )
}
