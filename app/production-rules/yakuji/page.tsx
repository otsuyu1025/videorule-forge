'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { YakujiRule, YakujiSettings } from '@/types'

type InputMode = 'text' | 'pdf' | 'txt'

interface ExtractPreview {
  source_name: string
  source_updated_at: string | null
  rules: YakujiRule[]
}

export default function YakujiPage() {
  const [settings, setSettings] = useState<YakujiSettings | null>(null)
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [textInput, setTextInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [preview, setPreview] = useState<ExtractPreview | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const pdfRef = useRef<HTMLInputElement>(null)
  const txtRef = useRef<HTMLInputElement>(null)

  const fetchSettings = async () => {
    const res = await fetch('/api/admin/yakuji')
    setSettings(await res.json() as YakujiSettings)
  }

  useEffect(() => { fetchSettings() }, [])

  const handleExtract = async () => {
    setError('')
    setPreview(null)
    setExtracting(true)
    try {
      let res: Response

      if (inputMode === 'pdf') {
        const file = pdfRef.current?.files?.[0]
        if (!file) { setError('PDFファイルを選択してください'); return }
        const form = new FormData()
        form.append('pdf', file)
        res = await fetch('/api/admin/yakuji/extract', { method: 'POST', body: form })

      } else if (inputMode === 'txt') {
        const file = txtRef.current?.files?.[0]
        if (!file) { setError('テキストファイルを選択してください'); return }
        const form = new FormData()
        form.append('file', file)
        res = await fetch('/api/admin/yakuji/extract', { method: 'POST', body: form })

      } else {
        if (!textInput.trim()) { setError('テキストを入力してください'); return }
        res = await fetch('/api/admin/yakuji/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textInput }),
        })
      }

      const data = await res.json()
      if (!res.ok) { setError(data.error || '取得エラー'); return }
      setPreview(data as ExtractPreview)
    } catch (e) {
      setError(e instanceof Error ? e.message : '不明なエラー')
    } finally {
      setExtracting(false)
    }
  }

  const handleSave = async () => {
    if (!preview) return
    setSaving(true)
    setError('')
    try {
      const body: Partial<YakujiSettings> = {
        source_name: preview.source_name,
        source_updated_at: preview.source_updated_at ?? undefined,
        imported_at: new Date().toISOString(),
        rules: preview.rules,
      }
      const res = await fetch('/api/admin/yakuji', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const updated: YakujiSettings = await res.json()
      setSettings(updated)
      setPreview(null)
      setTextInput('')
      if (pdfRef.current) pdfRef.current.value = ''
      if (txtRef.current) txtRef.current.value = ''
      setSuccessMsg('薬機法ルールを更新しました')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存エラー')
    } finally {
      setSaving(false)
    }
  }

  const TAB_LABELS: Record<InputMode, string> = {
    text: 'テキスト入力',
    txt: 'テキストファイル',
    pdf: 'PDF',
  }

  return (
    <div style={{ padding: 48, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 6 }}>
        <Link href="/production-rules/sources" style={{ color: '#2D334A', fontSize: 13, textDecoration: 'none', opacity: 0.6 }}>
          ← 知識ソース
        </Link>
      </div>

      <div style={{ marginBottom: 36, marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>
          Compliance
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#272343', margin: 0 }}>薬機法</h1>
        <p style={{ color: '#2D334A', marginTop: 8, fontSize: 14, lineHeight: 1.7, opacity: 0.8 }}>
          薬機法が改正されたら、このページから最新情報を登録してください。<br />
          薬機法チェックのON/OFFは
          <Link href="/settings" style={{ color: '#272343', fontWeight: 600 }}>設定画面</Link>
          から変更できます。
        </p>
      </div>

      {successMsg && (
        <div style={{ background: '#d4edda', border: '1px solid #c3e6cb', borderRadius: 8, padding: '12px 18px', marginBottom: 20, color: '#155724', fontSize: 14 }}>
          {successMsg}
        </div>
      )}

      {/* 現在の参照資料 */}
      {settings && settings.source_name && (
        <div style={{ background: '#F5FCFC', border: '1px solid #BAE8E8', borderRadius: 12, padding: '18px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.06em', marginBottom: 10, textTransform: 'uppercase' }}>現在の参照資料</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#272343', marginBottom: 4 }}>{settings.source_name}</div>
          {settings.source_updated_at && (
            <div style={{ fontSize: 13, color: '#2D334A', opacity: 0.7 }}>
              資料更新日: {new Date(settings.source_updated_at).toLocaleDateString('ja-JP')}
            </div>
          )}
          {settings.imported_at && (
            <div style={{ fontSize: 12, color: '#BAE8E8', marginTop: 4 }}>
              システム取込日: {new Date(settings.imported_at).toLocaleDateString('ja-JP')}
            </div>
          )}
          <div style={{ fontSize: 13, color: '#2D334A', marginTop: 10, opacity: 0.7 }}>
            ルール: {settings.rules?.length ?? 0} カテゴリ
          </div>
        </div>
      )}

      {/* ルール更新 */}
      <div style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#272343', marginBottom: 6 }}>ルールを更新する</div>
        <div style={{ fontSize: 13, color: '#2D334A', opacity: 0.7, marginBottom: 20, lineHeight: 1.7 }}>
          法令改正時は、厚生労働省の「医薬品等適正広告基準」の内容をいずれかの方法で入力してください。<br />
          AIが内容を解析し、新しい判定ルールを自動抽出します。
        </div>

        {/* 入力モード切替タブ */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #E3F6F5' }}>
          {(['text', 'txt', 'pdf'] as InputMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => { setInputMode(mode); setError('') }}
              style={{
                padding: '8px 16px', border: 'none', background: 'transparent',
                fontSize: 13, fontWeight: inputMode === mode ? 700 : 400,
                color: inputMode === mode ? '#272343' : '#999',
                borderBottom: inputMode === mode ? '2px solid #272343' : 'none',
                cursor: 'pointer', marginBottom: -2,
              }}
            >
              {TAB_LABELS[mode]}
            </button>
          ))}
        </div>

        {inputMode === 'text' && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#272343', display: 'block', marginBottom: 6 }}>
              薬機法の広告規制に関する内容を貼り付けてください
            </label>
            <textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="例: 医薬品等適正広告基準 第○条 医薬品の広告は、その効能効果について虚偽誇大な表現をしてはならない..."
              rows={10}
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid #BAE8E8',
                borderRadius: 8, fontSize: 13, color: '#272343', outline: 'none',
                resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 11, color: '#BAE8E8', marginTop: 4 }}>
              {textInput.length.toLocaleString()} 文字（上限 20,000 文字）
            </div>
          </div>
        )}

        {inputMode === 'txt' && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#272343', display: 'block', marginBottom: 6 }}>
              テキストファイル（.txt）を選択
            </label>
            <input
              ref={txtRef}
              type="file"
              accept=".txt,text/plain"
              style={{ fontSize: 14, color: '#272343' }}
            />
          </div>
        )}

        {inputMode === 'pdf' && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#272343', display: 'block', marginBottom: 6 }}>
              PDFファイルを選択
            </label>
            <input
              ref={pdfRef}
              type="file"
              accept=".pdf"
              style={{ fontSize: 14, color: '#272343' }}
            />
            <div style={{ fontSize: 11, color: '#BAE8E8', marginTop: 6, lineHeight: 1.6 }}>
              推奨: 厚生労働省「医薬品等適正広告基準」のPDF
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#721c24', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleExtract}
          disabled={extracting}
          style={{
            background: extracting ? '#BAE8E8' : '#272343', color: extracting ? '#fff' : '#FFD803',
            border: 'none', borderRadius: 8, padding: '10px 20px',
            fontWeight: 700, fontSize: 14, cursor: extracting ? 'default' : 'pointer',
          }}
        >
          {extracting ? '解析中...' : 'AIでルールを抽出'}
        </button>
      </div>

      {/* プレビュー */}
      {preview && (
        <div style={{ background: '#fff', border: '2px solid #272343', borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#272343', marginBottom: 16 }}>
            抽出結果プレビュー
          </div>

          <div style={{ background: '#F5FCFC', borderRadius: 8, padding: '14px 18px', marginBottom: 20 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#272343', marginBottom: 4 }}>{preview.source_name}</div>
            {preview.source_updated_at && (
              <div style={{ fontSize: 13, color: '#2D334A', opacity: 0.7 }}>
                資料更新日: {new Date(preview.source_updated_at).toLocaleDateString('ja-JP')}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {preview.rules.map(rule => (
              <div key={rule.id} style={{ background: '#FAFAFA', border: '1px solid #E3F6F5', borderRadius: 8, padding: '12px 16px' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#272343', marginBottom: 4 }}>{rule.label}</div>
                <div style={{ fontSize: 12, color: '#2D334A', opacity: 0.75, marginBottom: 8, lineHeight: 1.5 }}>{rule.description}</div>
                <div style={{ fontSize: 11, color: '#e74c3c' }}>
                  NG例: {rule.examples_ng.slice(0, 4).join('、')}
                </div>
                {rule.examples_ok && rule.examples_ok.length > 0 && (
                  <div style={{ fontSize: 11, color: '#27ae60', marginTop: 2 }}>
                    OK例: {rule.examples_ok.slice(0, 3).join('、')}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                background: saving ? '#BAE8E8' : '#272343', color: saving ? '#fff' : '#FFD803',
                border: 'none', borderRadius: 8, padding: '10px 20px',
                fontWeight: 700, fontSize: 14, cursor: saving ? 'default' : 'pointer',
              }}
            >
              {saving ? '保存中...' : 'この内容で保存'}
            </button>
            <button
              onClick={() => setPreview(null)}
              style={{
                background: '#fff', color: '#2D334A', border: '1px solid #BAE8E8',
                borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer',
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* 現在のルール一覧 */}
      {settings && settings.rules && settings.rules.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 14, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#272343' }}>
              判定ルール
            </div>
            <div style={{ fontSize: 13, color: '#BAE8E8' }}>
              {settings.rules.filter(r => r.enabled !== false).length} / {settings.rules.length} カテゴリ有効
            </div>
          </div>
          <div style={{ fontSize: 12, color: '#2D334A', opacity: 0.6, marginBottom: 16, lineHeight: 1.6 }}>
            業界・用途に応じて不要なカテゴリをOFFにすると、そのカテゴリはClaudeに送信されず費用を節約できます。
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {settings.rules.map(rule => {
              const isEnabled = rule.enabled !== false
              return (
                <div
                  key={rule.id}
                  style={{
                    background: isEnabled ? '#FAFAFA' : '#F5F5F5',
                    border: `1px solid ${isEnabled ? '#E3F6F5' : '#E0E0E0'}`,
                    borderRadius: 8, padding: '12px 16px',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    opacity: isEnabled ? 1 : 0.55,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#272343', marginBottom: 4 }}>{rule.label}</div>
                    <div style={{ fontSize: 12, color: '#2D334A', opacity: 0.7, lineHeight: 1.5 }}>{rule.description}</div>
                  </div>
                  <button
                    onClick={async () => {
                      const next = !isEnabled
                      setSettings(prev => prev ? {
                        ...prev,
                        rules: prev.rules.map(r => r.id === rule.id ? { ...r, enabled: next } : r),
                      } : prev)
                      await fetch('/api/admin/yakuji', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ruleId: rule.id, ruleEnabled: next }),
                      })
                    }}
                    title={isEnabled ? 'OFFにする' : 'ONにする'}
                    style={{
                      flexShrink: 0,
                      width: 40, height: 22,
                      borderRadius: 11,
                      border: 'none',
                      background: isEnabled ? '#272343' : '#CCC',
                      cursor: 'pointer',
                      position: 'relative',
                      transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute',
                      top: 3, left: isEnabled ? 21 : 3,
                      width: 16, height: 16, borderRadius: '50%',
                      background: isEnabled ? '#FFD803' : '#fff',
                      transition: 'left 0.2s',
                      display: 'block',
                    }} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
