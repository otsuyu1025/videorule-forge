'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type SourceKind = 'sampleVideo' | 'guideline' | 'yakuji' | null
type SampleMode = 'sns' | 'file'

const SNS_EXAMPLES = [
  { label: 'Instagram', placeholder: 'https://www.instagram.com/p/...' },
  { label: 'TikTok', placeholder: 'https://www.tiktok.com/@.../video/...' },
  { label: 'YouTube', placeholder: 'https://www.youtube.com/watch?v=...' },
  { label: 'Twitter/X', placeholder: 'https://x.com/.../status/...' },
]

// SNS_EXAMPLES は snsDownload フラグが有効な場合のみ使用

function fileTypeIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return '📄'
  if (ext === 'txt') return '📝'
  if (['doc', 'docx'].includes(ext ?? '')) return '📘'
  if (['ppt', 'pptx'].includes(ext ?? '')) return '📊'
  return '📎'
}

export default function SourcesNewPage() {
  const router = useRouter()
  const [kind, setKind] = useState<SourceKind>(null)
  const [snsDownloadEnabled, setSnsDownloadEnabled] = useState(false)
  const [sampleVideoEnabled, setSampleVideoEnabled] = useState(false)
  const [sampleMode, setSampleMode] = useState<SampleMode>('file')

  // SNS URL フォーム
  const [snsUrl, setSnsUrl] = useState('')
  const [snsTitle, setSnsTitle] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [snsBrowser, setSnsBrowser] = useState<string | null>(null)

  // 機能フラグとブラウザ設定を取得
  useEffect(() => {
    Promise.all([
      fetch('/api/features').then(r => r.json()),
      fetch('/api/settings').then(r => r.json()),
    ]).then(([features, settings]) => {
      setSnsDownloadEnabled(features.snsDownload === true)
      setSampleVideoEnabled(features.sampleVideoEnabled === true)
      setSnsBrowser(settings.snsBrowser ?? '')
    })
  }, [])

  // ファイルアップロードフォーム（お手本動画）
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoTitle, setVideoTitle] = useState('')
  const videoFileRef = useRef<HTMLInputElement>(null)

  // ガイドラインフォーム
  const [guidelineFile, setGuidelineFile] = useState<File | null>(null)
  const [guidelineTitle, setGuidelineTitle] = useState('')
  const guidelineFileRef = useRef<HTMLInputElement>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // SNS URL からダウンロード
  const handleSnsDownload = async (e: React.FormEvent) => {
    e.preventDefault()
    setDownloading(true)
    setError('')
    const res = await fetch('/api/videos/download-sns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snsUrl, customTitle: snsTitle.trim() || undefined }),
    })
    const data = await res.json()
    setDownloading(false)
    if (!res.ok) {
      setError(data.error || 'ダウンロードに失敗しました')
      return
    }
    router.push(`/videos/${data.id}`)
  }

  // 動画ファイルアップロード
  const handleVideoUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!videoFile) return
    setSubmitting(true)
    setError('')
    const fd = new FormData()
    fd.append('file', videoFile)
    fd.append('title', videoTitle || videoFile.name.replace(/\.[^.]+$/, ''))
    fd.append('type', 'sample')
    const res = await fetch('/api/videos', { method: 'POST', body: fd })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error || 'アップロードに失敗しました'); return }
    router.push(`/videos/${data.id}`)
  }

  // ガイドラインアップロード
  const handleGuidelineUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!guidelineFile) return
    setSubmitting(true)
    setError('')
    const fd = new FormData()
    fd.append('file', guidelineFile)
    fd.append('title', guidelineTitle || guidelineFile.name.replace(/\.[^.]+$/, ''))
    const res = await fetch('/api/guidelines', { method: 'POST', body: fd })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error || 'アップロードに失敗しました'); return }
    router.push(`/guidelines/${data.id}`)
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 8,
    border: '1px solid #E3F6F5', fontSize: 15, color: '#272343',
    boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
  }
  const focusHandler = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = '#BAE8E8'
  }
  const blurHandler = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = '#E3F6F5'
  }

  return (
    <div style={{ padding: 48, maxWidth: kind ? 680 : 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 4 }}>
        <Link href="/production-rules/sources" style={{ color: '#2D334A', fontSize: 13, textDecoration: 'none', opacity: 0.6 }}>
          ← 知識ソース一覧
        </Link>
      </div>
      <div style={{ marginBottom: 36, marginTop: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>
          Add Knowledge Source
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#272343', margin: 0 }}>
          知識ソースを追加
        </h1>
        <p style={{ color: '#2D334A', marginTop: 10, fontSize: 14, lineHeight: 1.7, opacity: 0.75 }}>
          何から動画制作ルールを育てますか？
        </p>
      </div>

      {/* 種別選択 */}
      {!kind && (
        <div style={{ display: 'grid', gridTemplateColumns: sampleVideoEnabled ? '1fr 1fr 1fr' : '1fr 1fr', gap: 16 }}>
          <button
            onClick={() => setKind('guideline')}
            style={{
              background: '#fff', border: '2px solid #E3F6F5', borderRadius: 14,
              padding: '28px 24px', cursor: 'pointer', textAlign: 'left',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#272343' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#E3F6F5' }}
          >
            <div style={{ fontSize: 32, marginBottom: 14 }}>📁</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#272343', marginBottom: 8 }}>ガイドラインをアップロード</div>
            <div style={{ fontSize: 13, color: '#2D334A', lineHeight: 1.7, opacity: 0.8 }}>デザインガイドラインやコンプライアンスルールなど、自社の制作基準となる文書をアップロードしてください。AIがルール候補の生成に活用します。</div>
          </button>

          <Link
            href="/production-rules/yakuji"
            style={{
              background: '#fff', border: '2px solid #E3F6F5', borderRadius: 14,
              padding: '28px 24px', textDecoration: 'none', display: 'block',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = '#272343' }}
            onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = '#E3F6F5' }}
          >
            <div style={{ fontSize: 32, marginBottom: 14 }}>⚖️</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#272343', marginBottom: 8 }}>薬機法をアップロード</div>
            <div style={{ fontSize: 13, color: '#2D334A', lineHeight: 1.7, opacity: 0.8 }}>薬機法の広告規制資料をテキスト・PDFで登録します。AIが判定ルールを自動抽出します。</div>
          </Link>

          {sampleVideoEnabled && (
            <button
              onClick={() => setKind('sampleVideo')}
              style={{
                background: '#fff', border: '2px solid #E3F6F5', borderRadius: 14,
                padding: '28px 24px', cursor: 'pointer', textAlign: 'left',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#272343' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E3F6F5' }}
            >
              <div style={{ fontSize: 32, marginBottom: 14 }}>🎬</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#272343', marginBottom: 8 }}>お手本動画を登録</div>
              <div style={{ fontSize: 13, color: '#2D334A', lineHeight: 1.7, opacity: 0.8 }}>AIが動画を解析してルール候補を生成します。</div>
            </button>
          )}
        </div>
      )}

      {/* お手本動画フォーム */}
      {kind === 'sampleVideo' && (
        <div style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 14, overflow: 'hidden' }}>
          {/* ヘッダー */}
          <div style={{ padding: '20px 28px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🎬</span>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', margin: 0 }}>お手本動画を登録</h2>
            <button onClick={() => setKind(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 13 }}>
              変更
            </button>
          </div>

          {/* タブ */}
          <div style={{ display: 'flex', gap: 0, padding: '16px 28px 0', borderBottom: '2px solid #E3F6F5', marginTop: 16 }}>
            {([
              ...(snsDownloadEnabled ? [{ key: 'sns' as SampleMode, label: '📱 SNSのURLから取得' }] : []),
              { key: 'file' as SampleMode, label: '📂 ファイルをアップロード' },
            ]).map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setSampleMode(tab.key); setError('') }}
                style={{
                  padding: '8px 18px', border: 'none', background: 'transparent',
                  fontSize: 13, fontWeight: sampleMode === tab.key ? 700 : 400,
                  color: sampleMode === tab.key ? '#272343' : '#999',
                  borderBottom: sampleMode === tab.key ? '2px solid #272343' : 'none',
                  cursor: 'pointer', marginBottom: -2,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* SNS URL フォーム (ENABLE_SNS_DOWNLOAD=true の場合のみ表示) */}
          {sampleMode === 'sns' && snsDownloadEnabled && (
            <form onSubmit={handleSnsDownload} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: '#F5FCFC', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#2D334A', lineHeight: 1.7 }}>
                <strong>対応SNS:</strong> Instagram・TikTok・YouTube・Twitter/X など<br />
                公開されている動画のURLを貼り付けてください。非公開・要ログインの動画は取得できません。
              </div>

              {/* Instagram URL かつブラウザ未設定の警告 */}
              {snsUrl.includes('instagram.com') && snsBrowser === '' && (
                <div style={{ background: '#FFF8DC', border: '1px solid #FFD803', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#2D334A', lineHeight: 1.7 }}>
                  ⚠️ Instagramの取得には<strong>ブラウザの設定</strong>が必要です。<br />
                  <Link href="/settings" style={{ color: '#272343', fontWeight: 700 }}>設定画面</Link>でInstagramにログイン済みのブラウザを選択してください。
                </div>
              )}

              {/* ブラウザ設定済みの表示 */}
              {snsUrl.includes('instagram.com') && snsBrowser && (
                <div style={{ background: '#F0FFF4', border: '1px solid #BAE8E8', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#2D334A' }}>
                  ✓ <strong>{snsBrowser}</strong> の Cookie を使用してInstagramにアクセスします。
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 8 }}>タイトル（任意）</label>
                <input
                  value={snsTitle}
                  onChange={e => setSnsTitle(e.target.value)}
                  placeholder="省略するとSNSのタイトルが自動入力されます"
                  disabled={downloading}
                  style={inputStyle}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 8 }}>
                  SNS動画のURL <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <input
                  required
                  type="url"
                  value={snsUrl}
                  onChange={e => setSnsUrl(e.target.value)}
                  placeholder={SNS_EXAMPLES[0].placeholder}
                  disabled={downloading}
                  style={inputStyle}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
                <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {SNS_EXAMPLES.map(ex => (
                    <span key={ex.label} style={{ fontSize: 11, color: '#BAE8E8', background: '#E3F6F5', padding: '2px 8px', borderRadius: 20 }}>
                      {ex.label}
                    </span>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{ padding: '12px 14px', background: '#fff0f0', borderRadius: 8, color: '#c0392b', fontSize: 13, lineHeight: 1.6 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={downloading || !snsUrl}
                  style={{
                    background: downloading || !snsUrl ? '#ccc' : '#272343',
                    color: '#FFD803', border: 'none', borderRadius: 8,
                    padding: '12px 24px', fontWeight: 700, fontSize: 14,
                    cursor: downloading || !snsUrl ? 'default' : 'pointer',
                  }}
                >
                  {downloading ? '⏬ ダウンロード中...' : '⏬ 取得する'}
                </button>
                <Link href="/production-rules/sources" style={{ background: 'transparent', color: '#2D334A', border: '1px solid #E3F6F5', borderRadius: 8, padding: '12px 18px', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  キャンセル
                </Link>
              </div>

              {downloading && (
                <div style={{ fontSize: 13, color: '#2D334A', opacity: 0.7, lineHeight: 1.6 }}>
                  yt-dlp で動画を取得しています。動画の長さによっては数十秒かかる場合があります...
                </div>
              )}
            </form>
          )}

          {/* ファイルアップロードフォーム */}
          {sampleMode === 'file' && (
            <form onSubmit={handleVideoUpload} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 8 }}>
                  動画ファイル <span style={{ color: '#e74c3c' }}>*</span>
                </label>
                <div
                  onClick={() => videoFileRef.current?.click()}
                  style={{
                    border: `2px dashed ${videoFile ? '#272343' : '#BAE8E8'}`,
                    borderRadius: 10, padding: '24px 20px', textAlign: 'center',
                    cursor: 'pointer', background: videoFile ? '#F5FCFC' : '#FAFAFA',
                  }}
                >
                  {videoFile ? (
                    <>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🎬</div>
                      <div style={{ fontWeight: 700, color: '#272343', fontSize: 15 }}>{videoFile.name}</div>
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{(videoFile.size / 1024 / 1024).toFixed(1)} MB</div>
                      <div style={{ fontSize: 12, color: '#BAE8E8', marginTop: 8 }}>クリックして変更</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#272343', marginBottom: 4 }}>クリックしてファイルを選択</div>
                      <div style={{ fontSize: 12, color: '#999' }}>MP4 / MOV / AVI / WebM</div>
                    </>
                  )}
                </div>
                <input
                  ref={videoFileRef}
                  type="file"
                  accept="video/*,.mp4,.mov,.avi,.webm,.mkv"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null
                    setVideoFile(f)
                    if (f && !videoTitle) setVideoTitle(f.name.replace(/\.[^.]+$/, ''))
                  }}
                  style={{ display: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 8 }}>タイトル</label>
                <input
                  value={videoTitle}
                  onChange={e => setVideoTitle(e.target.value)}
                  placeholder="省略するとファイル名が使われます"
                  style={inputStyle}
                  onFocus={focusHandler}
                  onBlur={blurHandler}
                />
              </div>

              {error && (
                <div style={{ padding: '12px 14px', background: '#fff0f0', borderRadius: 8, color: '#c0392b', fontSize: 13 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="submit"
                  disabled={submitting || !videoFile}
                  style={{
                    background: submitting || !videoFile ? '#ccc' : '#272343',
                    color: '#FFD803', border: 'none', borderRadius: 8,
                    padding: '12px 24px', fontWeight: 700, fontSize: 14,
                    cursor: submitting || !videoFile ? 'default' : 'pointer',
                  }}
                >
                  {submitting ? 'アップロード中...' : 'アップロードする'}
                </button>
                <Link href="/production-rules/sources" style={{ background: 'transparent', color: '#2D334A', border: '1px solid #E3F6F5', borderRadius: 8, padding: '12px 18px', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                  キャンセル
                </Link>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ガイドラインフォーム（変更なし） */}
      {kind === 'guideline' && (
        <div style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 14, padding: '28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <span style={{ fontSize: 22 }}>📁</span>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', margin: 0 }}>ガイドラインをアップロード</h2>
            <button onClick={() => setKind(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 13 }}>変更</button>
          </div>
          <form onSubmit={handleGuidelineUpload} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 8 }}>
                ファイル <span style={{ color: '#e74c3c' }}>*</span>
              </label>
              <div
                onClick={() => guidelineFileRef.current?.click()}
                style={{
                  border: `2px dashed ${guidelineFile ? '#272343' : '#BAE8E8'}`,
                  borderRadius: 10, padding: '28px 20px', textAlign: 'center',
                  cursor: 'pointer', background: guidelineFile ? '#F5FCFC' : '#FAFAFA',
                }}
              >
                {guidelineFile ? (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{fileTypeIcon(guidelineFile.name)}</div>
                    <div style={{ fontWeight: 700, color: '#272343', fontSize: 15 }}>{guidelineFile.name}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{(guidelineFile.size / 1024).toFixed(1)} KB</div>
                    <div style={{ fontSize: 12, color: '#BAE8E8', marginTop: 8 }}>クリックして変更</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>📂</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#272343', marginBottom: 4 }}>クリックしてファイルを選択</div>
                    <div style={{ fontSize: 12, color: '#999' }}>PDF・Word・テキスト (.pdf .docx .doc .txt)</div>
                  </>
                )}
              </div>
              <input
                ref={guidelineFileRef}
                type="file"
                accept=".txt,.pdf,.doc,.docx"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null
                  setGuidelineFile(f)
                  if (f && !guidelineTitle) setGuidelineTitle(f.name.replace(/\.[^.]+$/, ''))
                }}
                style={{ display: 'none' }}
              />
              {guidelineFile?.name.endsWith('.txt') && (
                <div style={{ fontSize: 12, color: '#27ae60', marginTop: 8, fontWeight: 600 }}>
                  ✓ テキストファイルです。AIがそのまま内容を解析できます。
                </div>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 8 }}>タイトル</label>
              <input
                value={guidelineTitle}
                onChange={e => setGuidelineTitle(e.target.value)}
                placeholder="例: ブランドガイドライン2024"
                style={inputStyle}
                onFocus={focusHandler}
                onBlur={blurHandler}
              />
            </div>
            {error && (
              <div style={{ padding: '10px 14px', background: '#fff0f0', borderRadius: 8, color: '#c0392b', fontSize: 13 }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="submit"
                disabled={submitting || !guidelineFile}
                style={{
                  background: submitting || !guidelineFile ? '#ccc' : '#272343',
                  color: '#FFD803', border: 'none', borderRadius: 8,
                  padding: '12px 24px', fontWeight: 700, fontSize: 14,
                  cursor: submitting || !guidelineFile ? 'default' : 'pointer',
                }}
              >
                {submitting ? 'アップロード中...' : 'アップロードする'}
              </button>
              <Link href="/production-rules/sources" style={{ background: 'transparent', color: '#2D334A', border: '1px solid #E3F6F5', borderRadius: 8, padding: '12px 18px', fontSize: 14, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                キャンセル
              </Link>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
