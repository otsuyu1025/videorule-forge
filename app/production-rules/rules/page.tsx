'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ProductionRule } from '@/types'

function SourceFooter({ rule }: { rule: ProductionRule }) {
  const src = rule.source

  const config = src
    ? src.type === 'sampleVideo'
      ? { bg: '#272343', labelColor: 'rgba(255,255,255,0.55)', nameColor: '#FFD803', icon: '🎬', typeLabel: 'お手本動画' }
      : { bg: '#E3F6F5', labelColor: '#999', nameColor: '#272343', icon: '📁', typeLabel: 'ガイドライン' }
    : { bg: '#F5F5F5', labelColor: '#aaa', nameColor: '#666', icon: '✏️', typeLabel: '手動追加' }

  return (
    <div style={{
      background: config.bg,
      padding: '8px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <span style={{ fontSize: 13 }}>{config.icon}</span>
      <span style={{ fontSize: 11, color: config.labelColor, fontWeight: 600, letterSpacing: '0.03em' }}>
        {config.typeLabel}
      </span>
      {src && (
        <>
          <span style={{ fontSize: 11, color: config.labelColor }}>|</span>
          <span style={{ fontSize: 12, color: config.nameColor, fontWeight: 700 }}>
            {src.name}
          </span>
        </>
      )}
      <span style={{ marginLeft: 'auto', fontSize: 11, color: src ? config.labelColor : '#aaa' }}>
        {new Date(rule.updatedAt).toLocaleDateString('ja-JP')}
      </span>
    </div>
  )
}

export default function RulesPage() {
  const [rules, setRules] = useState<ProductionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ content: '', category: '', reason: '' })

  const fetchRules = () => {
    fetch('/api/production-rules')
      .then(r => r.json())
      .then(d => { setRules(d); setLoading(false) })
  }

  useEffect(() => { fetchRules() }, [])

  const handleEdit = (rule: ProductionRule) => {
    setEditingId(rule.id)
    setEditForm({ content: rule.content, category: rule.category, reason: rule.reason })
  }

  const handleSaveEdit = async () => {
    await fetch(`/api/production-rules/${editingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setEditingId(null)
    fetchRules()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このルールを削除しますか？')) return
    await fetch(`/api/production-rules/${id}`, { method: 'DELETE' })
    fetchRules()
  }

  const filtered = rules.filter(r =>
    !search || r.content.includes(search) || r.category.includes(search)
  )

  const categories = [...new Set(filtered.map(r => r.category))]

  return (
    <div style={{ padding: 48, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 4 }}>
        <Link href="/production-rules" style={{ color: '#2D334A', fontSize: 13, textDecoration: 'none', opacity: 0.6 }}>
          ← 動画制作ルール
        </Link>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36, marginTop: 20 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>
            Rule Management
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#272343', margin: 0 }}>ルール管理</h1>
          <p style={{ color: '#2D334A', marginTop: 8, fontSize: 14, lineHeight: 1.7, opacity: 0.8 }}>
            正式に採用された動画制作ルールです。<br />
            {rules.length > 0 && <span style={{ fontWeight: 700, color: '#272343' }}>{rules.length} 件</span>} のルールが登録されています。
          </p>
        </div>
        <button
          onClick={() => {
            const content = prompt('ルールの内容を入力してください')
            if (!content) return
            const category = prompt('カテゴリを入力してください（例: ブランドカラー）') || 'その他'
            fetch('/api/production-rules', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content, category, reason: '' }),
            }).then(() => fetchRules())
          }}
          style={{ background: '#FFD803', color: '#272343', border: 'none', borderRadius: 8, padding: '11px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          + 手動で追加
        </button>
      </div>

      <div style={{ marginBottom: 28 }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ルール内容・カテゴリで検索..."
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #E3F6F5',
            fontSize: 14, color: '#272343', boxSizing: 'border-box', outline: 'none',
          }}
          onFocus={e => { e.target.style.borderColor = '#BAE8E8' }}
          onBlur={e => { e.target.style.borderColor = '#E3F6F5' }}
        />
      </div>

      {loading ? (
        <div style={{ color: '#2D334A', opacity: 0.6 }}>読み込み中...</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#E3F6F5', borderRadius: 14, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>📋</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#272343', marginBottom: 8 }}>
            {search ? `「${search}」に一致するルールがありません` : 'ルールがまだありません'}
          </div>
          {!search && (
            <div style={{ fontSize: 14, color: '#2D334A', opacity: 0.8, lineHeight: 1.8 }}>
              知識ソースを登録してルール候補を承認すると、ここに追加されます。
              <br />
              <Link href="/production-rules/candidates" style={{ color: '#272343', fontWeight: 700 }}>
                ルール候補を確認 →
              </Link>
            </div>
          )}
        </div>
      ) : (
        categories.map(cat => (
          <div key={cat} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ background: '#272343', color: '#FFD803', fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20 }}>
                {cat}
              </span>
              <span style={{ fontSize: 12, color: '#BAE8E8' }}>
                {filtered.filter(r => r.category === cat).length} 件
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.filter(r => r.category === cat).map(rule => (
                <div key={rule.id} style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 10, overflow: 'hidden' }}>
                  {editingId === rule.id ? (
                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <textarea
                        value={editForm.content}
                        onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                        rows={3}
                        style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #BAE8E8', fontSize: 14, color: '#272343', resize: 'vertical' }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <input value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })} placeholder="カテゴリ" style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #BAE8E8', fontSize: 14, color: '#272343' }} />
                        <input value={editForm.reason} onChange={e => setEditForm({ ...editForm, reason: e.target.value })} placeholder="理由（任意）" style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #BAE8E8', fontSize: 14, color: '#272343' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={handleSaveEdit} style={{ background: '#272343', color: '#FFD803', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>保存</button>
                        <button onClick={() => setEditingId(null)} style={{ background: 'transparent', color: '#999', border: '1px solid #ddd', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>キャンセル</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* ルール本文エリア */}
                      <div style={{ padding: '16px 20px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, color: '#272343', lineHeight: 1.65, marginBottom: rule.reason ? 8 : 0 }}>
                            {rule.content}
                          </div>
                          {rule.reason && (
                            <div style={{ fontSize: 12, color: '#2D334A', opacity: 0.6, lineHeight: 1.5 }}>
                              理由: {rule.reason}
                            </div>
                          )}
                          {rule.history.length > 0 && (
                            <div style={{ fontSize: 11, color: '#BAE8E8', marginTop: 6 }}>
                              更新 {rule.history.length} 回
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginLeft: 16, flexShrink: 0 }}>
                          <button onClick={() => handleEdit(rule)} style={{ background: '#E3F6F5', color: '#272343', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>編集</button>
                          <button onClick={() => handleDelete(rule.id)} style={{ background: 'transparent', color: '#ff6b6b', border: '1px solid #ffd0d0', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>削除</button>
                        </div>
                      </div>

                      {/* 出典フッター */}
                      <SourceFooter rule={rule} />
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
