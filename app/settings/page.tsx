'use client'

import { useState, useEffect } from 'react'
import type { SnsBrowser } from '@/types'

const BROWSERS: Array<{ value: SnsBrowser | ''; label: string; desc: string }> = [
  { value: '', label: '未設定', desc: 'YouTubeなどCookieなしで取得できるSNSのみ対応' },
  { value: 'safari', label: 'Safari', desc: 'macOS標準ブラウザ。SafariでInstagramにログインしておいてください' },
  { value: 'chrome', label: 'Google Chrome', desc: 'ChromeでInstagramにログインしておいてください' },
  { value: 'firefox', label: 'Firefox', desc: 'FirefoxでInstagramにログインしておいてください' },
  { value: 'brave', label: 'Brave', desc: 'BraveでInstagramにログインしておいてください' },
  { value: 'edge', label: 'Microsoft Edge', desc: 'EdgeでInstagramにログインしておいてください' },
]

const RETENTION_OPTIONS = [7, 14, 30, 60, 90]

export default function SettingsPage() {
  const [snsBrowser, setSnsBrowser] = useState<SnsBrowser | ''>('')
  const [frameRetentionDays, setFrameRetentionDays] = useState(30)
  const [browserSaved, setBrowserSaved] = useState(false)
  const [retentionSaved, setRetentionSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [snsEnabled, setSnsEnabled] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/features').then(r => r.json()),
    ]).then(([settings, features]) => {
      setSnsBrowser(settings.snsBrowser ?? '')
      setFrameRetentionDays(settings.frameRetentionDays ?? 30)
      setSnsEnabled(features.snsDownload === true)
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

  const saveBrowser = (value: SnsBrowser | '') => {
    setSnsBrowser(value)
    saveSetting({ snsBrowser: value || null }, () => {
      setBrowserSaved(true)
      setTimeout(() => setBrowserSaved(false), 2000)
    })
  }

  const saveRetention = (days: number) => {
    setFrameRetentionDays(days)
    saveSetting({ frameRetentionDays: days }, () => {
      setRetentionSaved(true)
      setTimeout(() => setRetentionSaved(false), 2000)
    })
  }

  const selectedBrowser = BROWSERS.find(b => b.value === snsBrowser) ?? BROWSERS[0]

  return (
    <div style={{ padding: 40, maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#272343', margin: 0 }}>設定</h1>
        <p style={{ color: '#2D334A', marginTop: 8, fontSize: 15 }}>
          プラットフォームの設定を管理します。
        </p>
      </div>

      {/* SNS取得設定 — ENABLE_SNS_DOWNLOAD=true の場合のみ表示 */}
      {!loading && snsEnabled && (
        <section style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 12, padding: 28, marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', marginTop: 0, marginBottom: 6 }}>
            SNS動画の取得
          </h2>
          <p style={{ fontSize: 14, color: '#2D334A', marginBottom: 24, lineHeight: 1.7 }}>
            Instagramなどの動画を取得するために、ログイン済みのブラウザを指定します。<br />
            yt-dlp が選択したブラウザの Cookie を自動的に読み取ります。
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#272343', display: 'block', marginBottom: 10 }}>
              使用するブラウザ
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {BROWSERS.map(b => (
                <label
                  key={b.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: `2px solid ${snsBrowser === b.value ? '#272343' : '#E3F6F5'}`,
                    background: snsBrowser === b.value ? '#272343' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  <input
                    type="radio"
                    name="snsBrowser"
                    value={b.value}
                    checked={snsBrowser === b.value}
                    onChange={() => saveBrowser(b.value as SnsBrowser | '')}
                    style={{ marginTop: 2, accentColor: '#FFD803' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: snsBrowser === b.value ? '#FFD803' : '#272343' }}>
                      {b.label}
                    </div>
                    <div style={{ fontSize: 12, color: snsBrowser === b.value ? 'rgba(255,255,255,0.7)' : '#999', marginTop: 2 }}>
                      {b.desc}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {browserSaved && (
            <div style={{ fontSize: 13, color: '#27ae60', fontWeight: 600 }}>✓ 保存しました</div>
          )}

          {snsBrowser && (
            <div style={{ marginTop: 16, padding: '14px 16px', background: '#E3F6F5', borderRadius: 8, fontSize: 13, color: '#2D334A', lineHeight: 1.7 }}>
              <strong>確認手順：</strong><br />
              1. <strong>{selectedBrowser.label}</strong> を開く<br />
              2. instagram.com にログインする<br />
              3. 「知識ソース → お手本動画を登録 → SNSのURLから取得」でInstagram URLを貼り付ける
            </div>
          )}
        </section>
      )}

      {/* フレーム画像の保持期間 */}
      <section style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 12, padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', marginTop: 0, marginBottom: 6 }}>
          フレーム画像の保持期間
        </h2>
        <p style={{ fontSize: 14, color: '#2D334A', marginBottom: 20, lineHeight: 1.7 }}>
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
                    padding: '10px 20px',
                    borderRadius: 8,
                    border: `2px solid ${frameRetentionDays === days ? '#272343' : '#E3F6F5'}`,
                    background: frameRetentionDays === days ? '#272343' : '#fff',
                    color: frameRetentionDays === days ? '#FFD803' : '#272343',
                    fontWeight: frameRetentionDays === days ? 700 : 400,
                    fontSize: 14,
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                >
                  {days}日
                </button>
              ))}
            </div>
            {retentionSaved && (
              <div style={{ fontSize: 13, color: '#27ae60', fontWeight: 600, marginTop: 12 }}>✓ 保存しました</div>
            )}
            <div style={{ marginTop: 14, fontSize: 12, color: '#999', lineHeight: 1.7 }}>
              現在の設定: <strong style={{ color: '#272343' }}>{frameRetentionDays}日</strong>後に自動削除<br />
              ※ Cloudflare R2 が設定されていない場合、この設定はローカルストレージには影響しません。
            </div>
          </>
        )}
      </section>

      {/* AI設定 */}
      <section style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 12, padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', marginTop: 0, marginBottom: 6 }}>AI設定</h2>
        <p style={{ fontSize: 14, color: '#2D334A', marginBottom: 12 }}>
          APIキーは環境変数 <code style={{ background: '#E3F6F5', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>ANTHROPIC_API_KEY</code>（<code style={{ background: '#E3F6F5', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>.env.local</code>）で設定してください。
        </p>
        <div style={{ fontSize: 13, color: '#999', lineHeight: 1.7 }}>
          ルール候補の生成・動画検品に使用されます。<br />
          APIキーがない場合、AI機能は利用できませんが他の機能は動作します。
        </div>
      </section>

      {/* データ管理 */}
      <section style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 12, padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', marginTop: 0, marginBottom: 6 }}>データ管理</h2>
        <p style={{ fontSize: 14, color: '#2D334A', marginBottom: 16 }}>
          データはローカルの <code style={{ background: '#E3F6F5', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>data/db.json</code> に保存されています。
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: '保管期間', desc: 'ルール候補：承認/却下後90日、動画：削除まで' },
            { label: 'バックアップ', desc: 'data/db.json を定期的にバックアップしてください' },
            { label: 'ログ', desc: 'エラーはコンソールに記録されます' },
            { label: 'セキュリティ', desc: 'APIキーは環境変数で管理してください' },
          ].map(item => (
            <div key={item.label} style={{ background: '#E3F6F5', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: '#2D334A' }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* プロダクト情報 */}
      <section style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 12, padding: 28 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', marginTop: 0, marginBottom: 16 }}>プロダクトについて</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'バージョン', value: '1.0.0 (MVP)' },
            { label: '設計思想', value: 'Rule First Design Architecture' },
            { label: '目的', value: '企業の動画制作ルールを育て、品質保証を継続的に改善する' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', gap: 16 }}>
              <div style={{ width: 120, fontSize: 13, color: '#999', fontWeight: 600, flexShrink: 0 }}>{item.label}</div>
              <div style={{ fontSize: 14, color: '#272343' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
