'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function GuidelineNewPage() {
  const router = useRouter()
  const [form, setForm] = useState({ title: '', content: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const res = await fetch('/api/guidelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const created = await res.json()
    router.push(`/guidelines/${created.id}`)
  }

  return (
    <div style={{ padding: 48, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/production-rules/sources" style={{ color: '#2D334A', fontSize: 13, textDecoration: 'none', opacity: 0.6 }}>
          ← 知識ソースへ戻る
        </Link>
      </div>

      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
          New Guideline
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#272343', margin: 0 }}>
          ガイドラインを追加
        </h1>
        <p style={{ color: '#2D334A', marginTop: 10, fontSize: 14, lineHeight: 1.7, opacity: 0.75 }}>
          AIがルール候補を生成するときに参照する知識を追加します。<br />
          ブランドガイドライン、デザインルール、コンプライアンス基準などを記載してください。
        </p>
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
              autoFocus
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
            {saving ? '追加中...' : '追加する'}
          </button>
          <Link
            href="/production-rules/sources"
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
