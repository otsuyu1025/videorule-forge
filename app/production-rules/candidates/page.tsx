'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { RuleCandidate } from '@/types'

function SourceTag({ candidate }: { candidate: RuleCandidate }) {
  if (!candidate.source) return null
  const isVideo = candidate.source.type === 'sampleVideo'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, padding: '2px 8px', borderRadius: 20,
      background: isVideo ? '#272343' : '#E3F6F5',
      color: isVideo ? '#FFD803' : '#272343',
      fontWeight: 600,
    }}>
      {isVideo ? '🎬' : '📁'} {candidate.source.name}
    </span>
  )
}

function CandidateCard({
  candidate, onAction, onEdit,
}: {
  candidate: RuleCandidate
  onAction: (id: string, status: 'approved' | 'rejected') => Promise<void>
  onEdit: (id: string, content: string, category: string, reason: string) => Promise<void>
}) {
  const [acting, setActing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editContent, setEditContent] = useState(candidate.content)
  const [editCategory, setEditCategory] = useState(candidate.category)
  const [editReason, setEditReason] = useState(candidate.reason)

  const act = async (status: 'approved' | 'rejected') => {
    setActing(true)
    await onAction(candidate.id, status)
  }

  const startEdit = () => {
    setEditContent(candidate.content)
    setEditCategory(candidate.category)
    setEditReason(candidate.reason)
    setEditing(true)
  }

  const saveEdit = async () => {
    if (!editContent.trim()) return
    setSaving(true)
    await onEdit(candidate.id, editContent.trim(), editCategory.trim(), editReason.trim())
    setSaving(false)
    setEditing(false)
  }

  const statusStyle: Record<string, React.CSSProperties> = {
    pending: { border: '1px solid #E3F6F5', background: '#fff' },
    approved: { border: '1px solid #BAE8E8', background: '#F0FFF8' },
    rejected: { border: '1px solid #ffd0d0', background: '#FFF8F8' },
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 7, fontSize: 14,
    border: '1px solid #BAE8E8', color: '#272343', fontFamily: 'inherit',
    boxSizing: 'border-box', outline: 'none',
  }

  return (
    <div style={{ borderRadius: 12, padding: '20px 24px', ...statusStyle[candidate.approvalStatus] }}>
      {editing ? (
        /* ── 編集モード ───────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#272343', display: 'block', marginBottom: 4 }}>カテゴリ</label>
            <input
              value={editCategory}
              onChange={e => setEditCategory(e.target.value)}
              style={{ ...inputStyle, width: 220 }}
              placeholder="例: ブランドカラー"
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#272343', display: 'block', marginBottom: 4 }}>ルール内容 <span style={{ color: '#e74c3c' }}>*</span></label>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#272343', display: 'block', marginBottom: 4 }}>根拠</label>
            <input
              value={editReason}
              onChange={e => setEditReason(e.target.value)}
              style={inputStyle}
              placeholder="このルールの根拠"
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={saveEdit}
              disabled={saving || !editContent.trim()}
              style={{ background: saving || !editContent.trim() ? '#ccc' : '#272343', color: '#FFD803', border: 'none', borderRadius: 7, padding: '9px 20px', fontWeight: 700, fontSize: 13, cursor: saving ? 'default' : 'pointer' }}
            >
              {saving ? '保存中...' : '✓ 確定する'}
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={saving}
              style={{ background: '#fff', color: '#999', border: '1px solid #ddd', borderRadius: 7, padding: '9px 16px', fontSize: 13, cursor: 'pointer' }}
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        /* ── 表示モード ───────────────────────────── */
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, background: '#272343', color: '#FFD803', padding: '2px 8px', borderRadius: 4 }}>
                {candidate.category}
              </span>
              <SourceTag candidate={candidate} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#272343', lineHeight: 1.6, marginBottom: 6 }}>
              {candidate.content}
            </div>
            <div style={{ fontSize: 13, color: '#2D334A', opacity: 0.75, lineHeight: 1.5 }}>
              根拠: {candidate.reason}
            </div>
            <div style={{ fontSize: 11, color: '#BAE8E8', marginTop: 8 }}>
              {new Date(candidate.createdAt).toLocaleDateString('ja-JP')}
            </div>
          </div>

          <div style={{ marginLeft: 20, flexShrink: 0 }}>
            {candidate.approvalStatus === 'pending' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <button
                  onClick={() => act('approved')}
                  disabled={acting}
                  style={{ background: acting ? '#ccc' : '#272343', color: '#FFD803', border: 'none', borderRadius: 7, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: acting ? 'default' : 'pointer', whiteSpace: 'nowrap' }}
                >
                  ✓ 承認する
                </button>
                <button
                  onClick={startEdit}
                  disabled={acting}
                  style={{ background: '#fff', color: acting ? '#ccc' : '#272343', border: `1px solid ${acting ? '#ddd' : '#272343'}`, borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: acting ? 'default' : 'pointer' }}
                >
                  ✏️ 編集
                </button>
                <button
                  onClick={() => act('rejected')}
                  disabled={acting}
                  style={{ background: '#fff', color: acting ? '#ccc' : '#666', border: `1px solid ${acting ? '#eee' : '#bbb'}`, borderRadius: 7, padding: '8px 18px', fontSize: 13, cursor: acting ? 'default' : 'pointer' }}
                >
                  却下
                </button>
              </div>
            )}
            {candidate.approvalStatus === 'approved' && (
              <span style={{ fontSize: 13, fontWeight: 700, color: '#27ae60' }}>✓ 承認済み</span>
            )}
            {candidate.approvalStatus === 'rejected' && (
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e74c3c' }}>✗ 却下</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<RuleCandidate[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectAllConfirm, setRejectAllConfirm] = useState(false)
  const [rejectingAll, setRejectingAll] = useState(false)

  const fetchCandidates = () => {
    setLoading(true)
    fetch('/api/rule-candidates?status=pending')
      .then(r => r.json())
      .then(d => { setCandidates(d); setLoading(false) })
  }

  useEffect(() => { fetchCandidates() }, [])

  const handleAction = async (id: string, status: 'approved' | 'rejected') => {
    await fetch(`/api/rule-candidates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalStatus: status }),
    })
    fetchCandidates()
  }

  const handleEdit = async (id: string, content: string, category: string, reason: string) => {
    await fetch(`/api/rule-candidates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, category, reason }),
    })
    fetchCandidates()
  }

  const handleRejectAll = async () => {
    setRejectingAll(true)
    await Promise.all(candidates.map(c =>
      fetch(`/api/rule-candidates/${c.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus: 'rejected' }),
      })
    ))
    setRejectingAll(false)
    setRejectAllConfirm(false)
    fetchCandidates()
  }

  return (
    <div style={{ padding: 48, maxWidth: 860, margin: '0 auto' }}>
      {/* 一括却下 確認ダイアログ */}
      {rejectAllConfirm && (
        <div
          onClick={() => { if (!rejectingAll) setRejectAllConfirm(false) }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, padding: '32px 36px',
              maxWidth: 420, width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, color: '#272343', marginBottom: 12 }}>
              すべて却下しますか？
            </div>
            <p style={{ fontSize: 14, color: '#2D334A', lineHeight: 1.7, marginBottom: 28 }}>
              承認待ちのルール候補 <strong>{candidates.length} 件</strong> をすべて却下します。<br />
              この操作は取り消せません。
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleRejectAll}
                disabled={rejectingAll}
                style={{
                  background: rejectingAll ? '#ccc' : '#e74c3c',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '11px 24px', fontWeight: 700, fontSize: 14,
                  cursor: rejectingAll ? 'default' : 'pointer',
                }}
              >
                {rejectingAll ? '処理中...' : 'すべて却下する'}
              </button>
              <button
                onClick={() => setRejectAllConfirm(false)}
                disabled={rejectingAll}
                style={{
                  background: '#fff', color: '#2D334A', border: '1px solid #E3F6F5',
                  borderRadius: 8, padding: '11px 20px', fontSize: 14, cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 4 }}>
        <Link href="/production-rules" style={{ color: '#2D334A', fontSize: 13, textDecoration: 'none', opacity: 0.6 }}>
          ← 検品ルール
        </Link>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36, marginTop: 20 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>
            Rule Candidates
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#272343', margin: 0 }}>ルール候補</h1>
          <p style={{ color: '#2D334A', marginTop: 8, fontSize: 14, lineHeight: 1.7, opacity: 0.8 }}>
            AIが知識ソースを解析して提案したルール候補です。<br />
            承認すると検品ルール一覧に表示され、検品ルールとして使うことができます。
          </p>
        </div>
        {!loading && candidates.length > 0 && (
          <button
            onClick={() => setRejectAllConfirm(true)}
            style={{
              background: '#fff', color: '#e74c3c',
              border: '1px solid #e74c3c', borderRadius: 8,
              padding: '10px 18px', fontWeight: 600, fontSize: 13,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            すべて却下
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ color: '#2D334A', opacity: 0.6 }}>読み込み中...</div>
      ) : candidates.length === 0 ? (
        <div style={{ background: '#E3F6F5', borderRadius: 14, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 14 }}>💡</div>
          <div style={{ fontWeight: 700, fontSize: 17, color: '#272343', marginBottom: 8 }}>
            承認待ちのルール候補はありません
          </div>
          <div style={{ fontSize: 14, color: '#2D334A', opacity: 0.8, lineHeight: 1.8 }}>
            知識ソースを登録・解析するとルール候補が生成されます。
            <br />
            <Link href="/production-rules/sources/new" style={{ color: '#272343', fontWeight: 700 }}>
              知識ソースを追加 →
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {candidates.map(c => (
            <CandidateCard key={c.id} candidate={c} onAction={handleAction} onEdit={handleEdit} />
          ))}
        </div>
      )}
    </div>
  )
}
