'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ProductionRule, YakujiSettings } from '@/types'

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
  const [yakuji, setYakuji] = useState<YakujiSettings | null>(null)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ content: '', category: '', reason: '' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ content: '', category: '', reason: '' })
  const [adding, setAdding] = useState(false)

  const fetchRules = () => {
    fetch('/api/production-rules')
      .then(r => r.json())
      .then(d => { setRules(d); setLoading(false) })
  }

  useEffect(() => {
    fetchRules()
    fetch('/api/admin/yakuji').then(r => r.json()).then(d => setYakuji(d as YakujiSettings))
  }, [])

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

  const handleAdd = async () => {
    if (!addForm.content.trim() || !addForm.category.trim()) return
    setAdding(true)
    await fetch('/api/production-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: addForm.content.trim(), category: addForm.category.trim(), reason: addForm.reason.trim() }),
    })
    setAdding(false)
    setShowAddForm(false)
    setAddForm({ content: '', category: '', reason: '' })
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
  const allCategories = [...new Set(rules.map(r => r.category))]

  // 検品プロンプトのトークン予算に基づく文字数制限
  // 出力 max_tokens=4096 / 1件あたり約100トークン = 約40件、1件100字換算 = 4,000字
  const CHAR_LIMIT = 4000
  const CHAR_WARN  = 3500
  const totalChars = rules.reduce((sum, r) => sum + r.content.length, 0)
  const charRatio  = Math.min(totalChars / CHAR_LIMIT, 1)
  const isOver     = totalChars > CHAR_LIMIT
  const isWarn     = !isOver && totalChars > CHAR_WARN

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
            {rules.length > 0
              ? <><span style={{ fontWeight: 700, color: '#272343' }}>{rules.length}件</span>のルールが登録されています。</>
              : 'まだルールは登録されていません。'}
          </p>

          {/* 検品トークン予算メーター */}
          {rules.length > 0 && (
            <div style={{ marginTop: 16, maxWidth: 420 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontSize: 12, color: '#2D334A', fontWeight: 600 }}>
                  検品で使用するルール総文字数
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  color: isOver ? '#e74c3c' : isWarn ? '#e67e22' : '#272343',
                }}>
                  {totalChars.toLocaleString()}字 / {CHAR_LIMIT.toLocaleString()}字
                </span>
              </div>
              {/* プログレスバー */}
              <div style={{ height: 6, background: '#E3F6F5', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${charRatio * 100}%`,
                  background: isOver ? '#e74c3c' : isWarn ? '#e67e22' : '#272343',
                  borderRadius: 3,
                  transition: 'width 0.3s',
                }} />
              </div>
              {/* 警告メッセージ */}
              {isOver && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#e74c3c', lineHeight: 1.6 }}>
                  ⚠️ ルール文字数の上限超過<br />
                  不要なルールを削除するか、ルール文を短くしてください。検品時にルールが途中で切れ、正確に判定されない可能性があります。
                </div>
              )}
              {isWarn && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#e67e22', lineHeight: 1.6 }}>
                  ⚠️ 上限まで残り{(CHAR_LIMIT - totalChars).toLocaleString()}字です。
                  これ以上ルールを増やす場合は既存のルールを整理してください。
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => { setShowAddForm(v => !v); setAddForm({ content: '', category: '', reason: '' }) }}
          style={{ background: showAddForm ? '#E3F6F5' : '#FFD803', color: '#272343', border: 'none', borderRadius: 8, padding: '11px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          {showAddForm ? '✕ キャンセル' : '+ 手動で追加'}
        </button>
      </div>

      {/* 手動追加フォーム */}
      {showAddForm && (
        <div style={{ background: '#fff', border: '1px solid #BAE8E8', borderRadius: 12, padding: '24px 28px', marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#272343', marginBottom: 18 }}>ルールを手動で追加</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 6 }}>
                ルール内容 <span style={{ color: '#e74c3c' }}>*</span>
              </label>
              <textarea
                value={addForm.content}
                onChange={e => setAddForm({ ...addForm, content: e.target.value })}
                rows={3}
                placeholder="例: ロゴは画面右下または左下に配置し、サイズは画面幅の8〜12%とする"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E3F6F5', fontSize: 14, color: '#272343', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6, outline: 'none' }}
                onFocus={e => { e.target.style.borderColor = '#BAE8E8' }}
                onBlur={e => { e.target.style.borderColor = '#E3F6F5' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 6 }}>
                  カテゴリ <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <input
                  list="add-category-options"
                  value={addForm.category}
                  onChange={e => setAddForm({ ...addForm, category: e.target.value })}
                  placeholder="例: ブランドカラー（既存から選ぶか入力）"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E3F6F5', fontSize: 14, color: '#272343', boxSizing: 'border-box', outline: 'none' }}
                  onFocus={e => { e.target.style.borderColor = '#BAE8E8' }}
                  onBlur={e => { e.target.style.borderColor = '#E3F6F5' }}
                />
                <datalist id="add-category-options">
                  {allCategories.map(cat => <option key={cat} value={cat} />)}
                </datalist>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 6 }}>
                  理由（任意）
                </label>
                <input
                  value={addForm.reason}
                  onChange={e => setAddForm({ ...addForm, reason: e.target.value })}
                  placeholder="このルールを設けた根拠"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #E3F6F5', fontSize: 14, color: '#272343', boxSizing: 'border-box', outline: 'none' }}
                  onFocus={e => { e.target.style.borderColor = '#BAE8E8' }}
                  onBlur={e => { e.target.style.borderColor = '#E3F6F5' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleAdd}
                disabled={adding || !addForm.content.trim() || !addForm.category.trim()}
                style={{ background: adding || !addForm.content.trim() || !addForm.category.trim() ? '#ccc' : '#272343', color: '#FFD803', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: adding ? 'default' : 'pointer' }}
              >
                {adding ? '追加中...' : '追加する'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                style={{ background: 'transparent', color: '#999', border: '1px solid #ddd', borderRadius: 8, padding: '10px 18px', fontSize: 14, cursor: 'pointer' }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* 薬機法セクション */}
      {yakuji && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ background: '#272343', color: '#FFD803', fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 20 }}>
              ⚖️ 薬機法
            </span>
            <span style={{ fontSize: 12, color: '#BAE8E8' }}>
              {(yakuji.rules?.length ?? 0) > 0
                ? `${yakuji.rules.filter(r => r.enabled !== false).length} / ${yakuji.rules.length} カテゴリ有効`
                : '未登録'}
            </span>
          </div>
          <div style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {(yakuji.rules?.length ?? 0) > 0 ? (
                <div>
                  <div style={{ fontSize: 14, color: '#272343', fontWeight: 600, marginBottom: 4 }}>
                    {yakuji.source_name ?? '薬機法ルール'}
                  </div>
                  <div style={{ fontSize: 12, color: '#2D334A', opacity: 0.6, lineHeight: 1.5 }}>
                    各ルールの編集・削除・ON/OFFは薬機法ページで管理できます。
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 14, color: '#2D334A', opacity: 0.6 }}>
                  薬機法ルールがまだ登録されていません。
                </div>
              )}
              <Link
                href="/production-rules/yakuji"
                style={{
                  background: '#E3F6F5', color: '#272343', border: 'none',
                  borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700,
                  textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0, marginLeft: 16,
                }}
              >
                薬機法ページで編集 →
              </Link>
            </div>
          </div>
        </div>
      )}

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
