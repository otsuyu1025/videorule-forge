'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { YakujiRule, YakujiSettings } from '@/types'

type InputMode = 'text' | 'txt' | 'json'

interface ExtractPreview {
  source_name: string
  source_updated_at: string | null
  rules: YakujiRule[]
}

const TAB_LABELS: Record<InputMode, string> = {
  text: 'テキスト入力',
  txt: 'テキストファイル',
  json: 'JSONファイル',
}

export default function YakujiPage() {
  const [settings, setSettings] = useState<YakujiSettings | null>(null)
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [textInput, setTextInput] = useState('')
  const [loadedText, setLoadedText] = useState('')   // txt/pdf → 編集可能テキスト
  const [loadedFileName, setLoadedFileName] = useState('')
  const [selectedTxtName, setSelectedTxtName] = useState('')
  const [selectedJsonName, setSelectedJsonName] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [preview, setPreview] = useState<ExtractPreview | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const txtRef = useRef<HTMLInputElement>(null)
  const jsonRef = useRef<HTMLInputElement>(null)

  const fetchSettings = async () => {
    const res = await fetch('/api/admin/yakuji')
    setSettings(await res.json() as YakujiSettings)
  }

  useEffect(() => { fetchSettings() }, [])

  const switchMode = (mode: InputMode) => {
    setInputMode(mode)
    setError('')
    setLoadedText('')
    setLoadedFileName('')
    setSelectedTxtName('')
    setSelectedJsonName('')
    setPreview(null)
  }

  // テキストファイル: クライアント側で読み込む（API不使用）
  const handleTxtLoad = async () => {
    const file = txtRef.current?.files?.[0]
    if (!file) { setError('ファイルを選択してください'); return }
    setError('')
    const text = await file.text()
    setLoadedText(text.slice(0, 20000))
    setLoadedFileName(file.name)
  }

  // JSON: クライアント側でパース・直接インポート（Claude不使用）
  const handleJsonLoad = () => {
    const file = jsonRef.current?.files?.[0]
    if (!file) { setError('JSONファイルを選択してください'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        if (!Array.isArray(data.rules) || data.rules.length === 0) {
          setError('有効な rules 配列が見つかりません')
          return
        }
        setPreview({
          source_name: data.source_name ?? file.name.replace(/\.json$/, ''),
          source_updated_at: data.source_updated_at ?? null,
          rules: data.rules as YakujiRule[],
        })
      } catch {
        setError('JSONの解析に失敗しました。正しい形式か確認してください。')
      }
    }
    reader.readAsText(file)
  }

  // Claude でルール抽出（text/txt/pdf の第2ステップ）
  const handleExtract = async () => {
    setError('')
    setPreview(null)
    setExtracting(true)
    try {
      const text = inputMode === 'text' ? textInput : loadedText
      if (!text.trim()) {
        setError(inputMode === 'text' ? 'テキストを入力してください' : 'テキストを読み込んでください')
        return
      }
      const res = await fetch('/api/admin/yakuji/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
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
      setLoadedText('')
      setLoadedFileName('')
      if (txtRef.current) txtRef.current.value = ''
      if (jsonRef.current) jsonRef.current.value = ''
      setSelectedTxtName('')
      setSelectedJsonName('')
      setSuccessMsg('薬機法ルールを更新しました')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存エラー')
    } finally {
      setSaving(false)
    }
  }

  const canExtract = inputMode === 'text' ? textInput.trim().length > 0 : loadedText.trim().length > 0

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
          薬機法が改正されたら、このページから最新情報を登録してください。
        </p>
        <div style={{ marginTop: 10, fontSize: 13, lineHeight: 2 }}>
          <div>
            <span style={{ display: 'inline-block', background: '#d4edda', color: '#155724', fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 4, marginRight: 8, verticalAlign: 'middle' }}>必須</span>
            <span style={{ color: '#2D334A' }}>第十章　医薬品等の広告</span>
          </div>
          <div>
            <span style={{ display: 'inline-block', background: '#fff3cd', color: '#856404', fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 4, marginRight: 8, verticalAlign: 'middle' }}>任意</span>
            <span style={{ color: '#2D334A', opacity: 0.8 }}>第十一〜十八章</span>
          </div>
          <div>
            <span style={{ display: 'inline-block', background: '#e2e3e5', color: '#6c757d', fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 4, marginRight: 8, verticalAlign: 'middle' }}>不要</span>
            <span style={{ color: '#2D334A', opacity: 0.5 }}>第一〜九章</span>
          </div>
        </div>
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

      {/* ルール更新セクション */}
      <div style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#272343', marginBottom: 6 }}>ルールを更新する</div>
        <div style={{ fontSize: 13, color: '#2D334A', opacity: 0.7, marginBottom: 20, lineHeight: 1.7 }}>
          法令改正時は最新の内容をいずれかの方法で入力してください。<br />
          テキスト・PDFは読み込み後に編集してから送信できます。JSONはAIを使わず直接インポートします。
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #E3F6F5' }}>
          {(['text', 'txt', 'json'] as InputMode[]).map(mode => (
            <button
              key={mode}
              onClick={() => switchMode(mode)}
              style={{
                padding: '8px 14px', border: 'none', background: 'transparent',
                fontSize: 13, fontWeight: inputMode === mode ? 700 : 400,
                color: inputMode === mode ? '#272343' : '#999',
                borderBottom: inputMode === mode ? '2px solid #272343' : 'none',
                cursor: 'pointer', marginBottom: -2, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              {TAB_LABELS[mode]}
              {mode === 'json' && (
                <span style={{ fontSize: 10, fontWeight: 700, color: '#27ae60' }}>AI不使用</span>
              )}
            </button>
          ))}
        </div>

        {/* テキスト入力 */}
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

        {/* テキストファイル */}
        {inputMode === 'txt' && !loadedText && (
          <div style={{ marginBottom: 20 }}>
            <div
              onClick={() => txtRef.current?.click()}
              style={{
                border: `2px dashed ${selectedTxtName ? '#272343' : '#BAE8E8'}`,
                borderRadius: 10, padding: '28px 20px', textAlign: 'center',
                cursor: 'pointer', background: selectedTxtName ? '#F5FCFC' : '#FAFAFA',
                transition: 'border-color 0.15s, background 0.15s', marginBottom: 14,
              }}
              onMouseEnter={e => { if (!selectedTxtName) e.currentTarget.style.borderColor = '#272343' }}
              onMouseLeave={e => { if (!selectedTxtName) e.currentTarget.style.borderColor = '#BAE8E8' }}
            >
              {selectedTxtName ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📝</div>
                  <div style={{ fontWeight: 700, color: '#272343', fontSize: 15, marginBottom: 4 }}>{selectedTxtName}</div>
                  <div style={{ fontSize: 12, color: '#BAE8E8' }}>クリックして変更</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📝</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#272343', marginBottom: 4 }}>クリックして.txtファイルを選択</div>
                  <div style={{ fontSize: 12, color: '#999' }}>.txt テキストファイル</div>
                </>
              )}
            </div>
            <input
              ref={txtRef}
              type="file"
              accept=".txt,text/plain"
              onChange={e => setSelectedTxtName(e.target.files?.[0]?.name ?? '')}
              style={{ display: 'none' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={handleTxtLoad}
                disabled={!selectedTxtName}
                style={{
                  background: selectedTxtName ? '#272343' : '#E0E0E0',
                  color: selectedTxtName ? '#FFD803' : '#999',
                  border: 'none', borderRadius: 8, padding: '10px 20px',
                  fontWeight: 700, fontSize: 14,
                  cursor: selectedTxtName ? 'pointer' : 'default',
                }}
              >
                テキストを読み込む
              </button>
              <span style={{ fontSize: 11, color: '#BAE8E8' }}>クライアント側で読み込み（API不使用）</span>
            </div>
          </div>
        )}

        {/* テキストファイル読み込み後: 編集可能テキスト */}
        {inputMode === 'txt' && loadedText && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#272343' }}>
                読み込んだテキスト（不要な箇所を削除してから抽出できます）
              </label>
              <span style={{ fontSize: 11, color: '#BAE8E8' }}>📎 {loadedFileName}</span>
            </div>
            <textarea
              value={loadedText}
              onChange={e => setLoadedText(e.target.value)}
              rows={10}
              style={{
                width: '100%', padding: '10px 14px', border: '1px solid #BAE8E8',
                borderRadius: 8, fontSize: 13, color: '#272343', outline: 'none',
                resize: 'vertical', lineHeight: 1.6, boxSizing: 'border-box',
              }}
            />
            <div style={{ fontSize: 11, color: '#BAE8E8', marginTop: 4 }}>
              {loadedText.length.toLocaleString()} 文字
            </div>
          </div>
        )}

        {/* JSON */}
        {inputMode === 'json' && !preview && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ background: '#F0FFF4', border: '1px solid #c3e6cb', borderRadius: 8, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#2D334A', lineHeight: 1.7 }}>
              <strong>AI不使用</strong> — 過去にエクスポートしたJSONや手動作成したルール定義ファイルを直接インポートします。<br />
              形式: <code style={{ background: '#E3F6F5', padding: '1px 6px', borderRadius: 3, fontSize: 12 }}>
                {'{ "source_name": "...", "rules": [{ "id", "label", "description", "examples_ng" }] }'}
              </code>
            </div>
            <div
              onClick={() => jsonRef.current?.click()}
              style={{
                border: `2px dashed ${selectedJsonName ? '#272343' : '#BAE8E8'}`,
                borderRadius: 10, padding: '28px 20px', textAlign: 'center',
                cursor: 'pointer', background: selectedJsonName ? '#F5FCFC' : '#FAFAFA',
                transition: 'border-color 0.15s, background 0.15s', marginBottom: 14,
              }}
              onMouseEnter={e => { if (!selectedJsonName) e.currentTarget.style.borderColor = '#272343' }}
              onMouseLeave={e => { if (!selectedJsonName) e.currentTarget.style.borderColor = '#BAE8E8' }}
            >
              {selectedJsonName ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                  <div style={{ fontWeight: 700, color: '#272343', fontSize: 15, marginBottom: 4 }}>{selectedJsonName}</div>
                  <div style={{ fontSize: 12, color: '#BAE8E8' }}>クリックして変更</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#272343', marginBottom: 4 }}>クリックしてJSONを選択</div>
                  <div style={{ fontSize: 12, color: '#999' }}>.json ファイル</div>
                </>
              )}
            </div>
            <input
              ref={jsonRef}
              type="file"
              accept=".json,application/json"
              onChange={e => setSelectedJsonName(e.target.files?.[0]?.name ?? '')}
              style={{ display: 'none' }}
            />
            <button
              onClick={handleJsonLoad}
              disabled={!selectedJsonName}
              style={{
                background: selectedJsonName ? '#272343' : '#E0E0E0',
                color: selectedJsonName ? '#FFD803' : '#999',
                border: 'none', borderRadius: 8, padding: '10px 20px',
                fontWeight: 700, fontSize: 14,
                cursor: selectedJsonName ? 'pointer' : 'default',
              }}
            >
              JSONを読み込む
            </button>
          </div>
        )}

        {error && (
          <div style={{ background: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: 8, padding: '10px 14px', marginBottom: 14, color: '#721c24', fontSize: 13 }}>
            {error}
          </div>
        )}

        {/* AI抽出ボタン（text/txt/pdf のみ） */}
        {inputMode !== 'json' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={handleExtract}
              disabled={extracting || !canExtract}
              style={{
                background: extracting || !canExtract ? '#BAE8E8' : '#272343',
                color: extracting || !canExtract ? '#fff' : '#FFD803',
                border: 'none', borderRadius: 8, padding: '10px 20px',
                fontWeight: 700, fontSize: 14,
                cursor: extracting || !canExtract ? 'default' : 'pointer',
              }}
            >
              {extracting ? '解析中...' : 'AIでルールを抽出'}
            </button>
            {inputMode === 'txt' && loadedText && (
              <button
                onClick={() => { setLoadedText(''); setLoadedFileName('') }}
                style={{
                  background: 'none', border: '1px solid #BAE8E8', borderRadius: 8,
                  padding: '10px 16px', fontSize: 13, color: '#2D334A', cursor: 'pointer',
                }}
              >
                ← ファイルを選び直す
              </button>
            )}
          </div>
        )}
      </div>

      {/* プレビュー */}
      {preview && (
        <div style={{ background: '#fff', border: '2px solid #272343', borderRadius: 14, padding: '24px 28px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#272343' }}>抽出結果プレビュー</div>
            {inputMode === 'json' && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#27ae60', background: '#d4edda', padding: '2px 8px', borderRadius: 20 }}>
                AI不使用
              </span>
            )}
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

      {/* 現在のルール一覧 + トグル */}
      {settings && settings.rules && settings.rules.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 14, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#272343' }}>判定ルール</div>
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
                      flexShrink: 0, width: 40, height: 22, borderRadius: 11,
                      border: 'none', background: isEnabled ? '#272343' : '#CCC',
                      cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3, left: isEnabled ? 21 : 3,
                      width: 16, height: 16, borderRadius: '50%',
                      background: isEnabled ? '#FFD803' : '#fff',
                      transition: 'left 0.2s', display: 'block',
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
