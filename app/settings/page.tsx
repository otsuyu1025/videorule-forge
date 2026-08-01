'use client'

import { useState, useEffect } from 'react'

const RETENTION_OPTIONS = [7, 14, 30, 60, 90]
const VISION_INTERVAL_OPTIONS = [1, 2, 3, 5, 10]

function Toggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
        background: active ? '#272343' : '#BAE8E8',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: active ? 27 : 3,
        width: 22, height: 22, borderRadius: '50%',
        background: active ? '#FFD803' : '#fff',
        transition: 'left 0.2s', display: 'block',
      }} />
    </button>
  )
}

export default function SettingsPage() {
  const [frameRetentionDays, setFrameRetentionDays] = useState(30)
  const [visionFrameInterval, setVisionFrameInterval] = useState(1)
  const [retentionSaved, setRetentionSaved] = useState(false)
  const [visionIntervalSaved, setVisionIntervalSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [yakujiEnabled, setYakujiEnabled] = useState(false)
  const [yakujiSaved, setYakujiSaved] = useState(false)
  const [transcriptionDisabled, setTranscriptionDisabled] = useState(false)
  const [transcriptionSaved, setTranscriptionSaved] = useState(false)
  const [sampleVideoEnabled, setSampleVideoEnabled] = useState(false)
  const [sampleVideoSaved, setSampleVideoSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/features').then(r => r.json()),
      fetch('/api/admin/yakuji').then(r => r.json()),
    ]).then(([settings, features, yakuji]) => {
      setFrameRetentionDays(settings.frameRetentionDays ?? 30)
      setVisionFrameInterval(features.visionFrameInterval ?? 3)
      setTranscriptionDisabled(features.transcriptionDisabled === true)
      setSampleVideoEnabled(features.sampleVideoEnabled === true)
      setYakujiEnabled(yakuji.enabled ?? false)
      setLoading(false)
    })
  }, [])

  const saveSetting = async (patch: Record<string, unknown>, onSaved: () => void) => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    onSaved()
  }

  const saveRetention = (days: number) => {
    setFrameRetentionDays(days)
    saveSetting({ frameRetentionDays: days }, () => {
      setRetentionSaved(true)
      setTimeout(() => setRetentionSaved(false), 2000)
    })
  }

  const saveVisionInterval = (seconds: number) => {
    setVisionFrameInterval(seconds)
    saveSetting({ visionFrameInterval: seconds }, () => {
      setVisionIntervalSaved(true)
      setTimeout(() => setVisionIntervalSaved(false), 2000)
    })
  }

  const toggleSampleVideo = async (next: boolean) => {
    setSampleVideoEnabled(next)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sampleVideoEnabled: next }),
    })
    setSampleVideoSaved(true)
    setTimeout(() => setSampleVideoSaved(false), 2000)
  }

  const toggleTranscription = async (nextDisabled: boolean) => {
    setTranscriptionDisabled(nextDisabled)
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcriptionDisabled: nextDisabled }),
    })
    setTranscriptionSaved(true)
    setTimeout(() => setTranscriptionSaved(false), 2000)
  }

  const toggleYakuji = async (next: boolean) => {
    setYakujiEnabled(next)
    await fetch('/api/admin/yakuji', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next }),
    })
    setYakujiSaved(true)
    setTimeout(() => setYakujiSaved(false), 2000)
  }

  const section: React.CSSProperties = {
    background: '#fff', border: '1px solid #E3F6F5', borderRadius: 12, padding: 28, marginBottom: 16,
  }
  const categoryLabel: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em',
    textTransform: 'uppercase', marginBottom: 12,
  }
  const sectionTitle: React.CSSProperties = {
    fontSize: 18, fontWeight: 700, color: '#272343', marginTop: 0, marginBottom: 6,
  }
  const sectionDesc: React.CSSProperties = {
    fontSize: 14, color: '#2D334A', marginBottom: 20, lineHeight: 1.7,
  }
  const saved = { fontSize: 13, color: '#27ae60', fontWeight: 600 } as React.CSSProperties

  return (
    <div style={{ padding: 40, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#272343', margin: 0 }}>設定</h1>
        <p style={{ color: '#2D334A', marginTop: 8, fontSize: 15 }}>
          プラットフォームの設定を管理します。
        </p>
      </div>

      {/* ── 知識ソース ── */}
      <div style={{ marginBottom: 40 }}>
        <p style={categoryLabel}>知識ソース</p>

        <section style={section}>
          <h2 style={sectionTitle}>お手本動画からのルール登録</h2>
          <p style={sectionDesc}>
            「良い動画のサンプル」を登録してAIにルールを学習させる機能です。<br />
            OFFにすると、知識ソースの追加画面からお手本動画の登録が非表示になります。
          </p>
          {loading ? (
            <div style={{ color: '#999', fontSize: 14 }}>読み込み中...</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Toggle active={sampleVideoEnabled} onToggle={() => toggleSampleVideo(!sampleVideoEnabled)} />
              <span style={{ fontSize: 14, color: '#272343' }}>
                {sampleVideoEnabled ? '有効 — お手本動画の登録・管理ができます' : '無効 — 知識ソース追加画面に表示されません'}
              </span>
              {sampleVideoSaved && <span style={saved}>✓ 保存しました</span>}
            </div>
          )}
        </section>

        <section style={{ ...section, marginBottom: 0 }}>
          <h2 style={sectionTitle}>薬機法からのルール登録</h2>
          <p style={sectionDesc}>
            薬機法（医薬品医療機器等法）の広告規制に関する記述からAIにルールを学習させる機能です。<br />
            ルールの管理・資料の更新は
            <a href="/production-rules/yakuji" style={{ color: '#272343', fontWeight: 600 }}>動画制作ルール → 薬機法</a>
            から行えます。
          </p>
          {loading ? (
            <div style={{ color: '#999', fontSize: 14 }}>読み込み中...</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Toggle active={yakujiEnabled} onToggle={() => toggleYakuji(!yakujiEnabled)} />
              <span style={{ fontSize: 14, color: '#272343' }}>
                {yakujiEnabled ? '有効 — 薬機法資料からルールを自動抽出します' : '無効 — 薬機法からのルール登録は行いません'}
              </span>
              {yakujiSaved && <span style={saved}>✓ 保存しました</span>}
            </div>
          )}
        </section>
      </div>

      {/* ── 動画検品 ── */}
      <div>
        <p style={categoryLabel}>動画検品</p>

        <section style={section}>
          <h2 style={sectionTitle}>フレーム画像の保持期間</h2>
          <p style={sectionDesc}>
            動画解析時に抽出したフレーム画像を何日間保持するかを設定します。<br />
            期限を過ぎたフレームはサーバーの日次クリーンアップで自動削除されます。
          </p>
          {loading ? (
            <div style={{ color: '#999', fontSize: 14 }}>読み込み中...</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {RETENTION_OPTIONS.map(days => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => saveRetention(days)}
                    style={{
                      padding: '10px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer', transition: 'all 0.1s',
                      border: `2px solid ${frameRetentionDays === days ? '#272343' : '#E3F6F5'}`,
                      background: frameRetentionDays === days ? '#272343' : '#fff',
                      color: frameRetentionDays === days ? '#FFD803' : '#272343',
                      fontWeight: frameRetentionDays === days ? 700 : 400,
                    }}
                  >
                    {days}日
                  </button>
                ))}
              </div>
              {retentionSaved && <div style={{ ...saved, marginTop: 12 }}>✓ 保存しました</div>}
              <div style={{ marginTop: 14, fontSize: 12, color: '#999', lineHeight: 1.7 }}>
                現在の設定: <strong style={{ color: '#272343' }}>{frameRetentionDays}日</strong>後に自動削除<br />
                ※ Cloudflare R2 が設定されていない場合は、自動削除対象外です。
              </div>
            </>
          )}
        </section>

        <section style={section}>
          <h2 style={sectionTitle}>音声文字起こし</h2>
          <p style={sectionDesc}>
            動画解析時に Whisper で音声を文字起こしし、検品に活用します。<br />
            メモリ使用量（約244MB）が増加するため、Railway Hobby プランでは OFF を推奨します。
          </p>
          {loading ? (
            <div style={{ color: '#999', fontSize: 14 }}>読み込み中...</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Toggle active={!transcriptionDisabled} onToggle={() => toggleTranscription(!transcriptionDisabled)} />
              <span style={{ fontSize: 14, color: '#272343' }}>
                {!transcriptionDisabled ? '有効 — 音声を文字起こしして検品に活用します' : '無効 — 音声文字起こしをスキップします'}
              </span>
              {transcriptionSaved && <span style={saved}>✓ 保存しました</span>}
            </div>
          )}
        </section>

        <section style={{ ...section, marginBottom: 0 }}>
          <h2 style={sectionTitle}>Vision OCR のフレーム間隔</h2>
          <p style={sectionDesc}>
            AIが動画内のテキスト（テロップ・字幕）を読み取る際に、何秒ごとに1枚のフレームを解析するかを設定します。<br />
            間隔を長くすると処理が速くなりますが、短い時間だけ表示されるテロップを見逃す可能性があります。<br />
            <span style={{ fontSize: 12, color: '#999' }}>※ 最大10枚まで。サーバーのメモリ制限（512MB）への対応として設定しています。</span>
          </p>
          {loading ? (
            <div style={{ color: '#999', fontSize: 14 }}>読み込み中...</div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {VISION_INTERVAL_OPTIONS.map(sec => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => saveVisionInterval(sec)}
                    style={{
                      padding: '10px 20px', borderRadius: 8, fontSize: 14, cursor: 'pointer', transition: 'all 0.1s',
                      border: `2px solid ${visionFrameInterval === sec ? '#272343' : '#E3F6F5'}`,
                      background: visionFrameInterval === sec ? '#272343' : '#fff',
                      color: visionFrameInterval === sec ? '#FFD803' : '#272343',
                      fontWeight: visionFrameInterval === sec ? 700 : 400,
                    }}
                  >
                    {sec}秒ごと
                  </button>
                ))}
              </div>
              {visionIntervalSaved && <div style={{ ...saved, marginTop: 12 }}>✓ 保存しました</div>}
              <div style={{ marginTop: 14, fontSize: 12, color: '#999', lineHeight: 1.7 }}>
                現在の設定: <strong style={{ color: '#272343' }}>{visionFrameInterval}秒ごとに1枚</strong>（最大20枚・超過分はバッチ処理）<br />
                目安: 30秒の動画 → {Math.min(30, Math.ceil(30 / visionFrameInterval))}枚のフレームを解析
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
