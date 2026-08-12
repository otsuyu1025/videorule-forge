'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Video, VideoFeature, RuleCandidate, InspectionReport } from '@/types'

// 処理中とみなすステータス（後方互換で 'analyzing' も含む）
const IN_PROGRESS_STATUSES = [
  'downloading',
  'extracting_meta', 'extracting_frames', 'running_ocr',
  'transcribing', 'generating_candidates', 'analyzing',
]
// awaiting_review は一時停止状態（処理中ではない）

const STATUS_LABELS: Partial<Record<string, string>> = {
  pending: '未解析',
  downloading: 'ダウンロード中',
  extracting_meta: '動画情報取得中',
  extracting_frames: 'フレーム抽出中',
  running_ocr: 'テキスト読み取り中',
  transcribing: '音声文字起こし中',
  awaiting_review: '確認待ち',
  generating_candidates: 'ルール候補生成中',
  analyzing: '解析中',
  analyzed: '解析完了',
  error: 'エラー',
}

function DownloadProgress() {
  return (
    <div style={{ background: '#E3F6F5', borderRadius: 14, padding: '28px 32px', marginBottom: 32 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#272343', marginBottom: 20 }}>
        SNS動画をダウンロード中...
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#FFD803', border: '2px solid #FFD803',
          fontSize: 13, fontWeight: 700, color: '#272343',
        }}>
          ●
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#272343' }}>
            動画を取得中 <span style={{ color: '#FFD803' }}>実行中</span>
          </div>
          <div style={{ fontSize: 11, color: '#BAE8E8' }}>yt-dlp</div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#2D334A', opacity: 0.7, lineHeight: 1.7 }}>
        動画の長さやネットワーク速度によって、数秒〜数分かかる場合があります。<br />
        ダウンロードが完了すると自動的に「動画を解析する」ボタンが表示されます。
      </div>
    </div>
  )
}

function AnalysisProgress({ status, isSample }: { status: string; isSample: boolean }) {
  const steps = [
    { key: 'extracting_meta', label: '動画情報を取得', detail: 'ffprobe' },
    { key: 'extracting_frames', label: 'フレームを抽出', detail: 'ffmpeg' },
    { key: 'running_ocr', label: 'テキストを読み取り', detail: 'Vision OCR' },
    { key: 'transcribing', label: '音声を文字起こし', detail: 'Whisper' },
    ...(isSample ? [{ key: 'generating_candidates', label: 'ルール候補を生成', detail: 'Claude AI' }] : []),
  ]
  const stepKeys = steps.map(s => s.key)
  const currentIdx = stepKeys.indexOf(status)

  return (
    <div style={{ background: '#E3F6F5', borderRadius: 14, padding: '28px 32px', marginBottom: 32 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#272343', marginBottom: 20 }}>
        解析中...
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((step, idx) => {
          const isDone = idx < currentIdx
          const isCurrent = idx === currentIdx || (status === 'analyzing' && idx === 0)
          return (
            <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDone ? '#272343' : isCurrent ? '#FFD803' : '#fff',
                border: `2px solid ${isDone ? '#272343' : isCurrent ? '#FFD803' : '#BAE8E8'}`,
                fontSize: 13, fontWeight: 700,
                color: isDone ? '#FFD803' : isCurrent ? '#272343' : '#BAE8E8',
              }}>
                {isDone ? '✓' : isCurrent ? '●' : idx + 1}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? '#272343' : isDone ? '#2D334A' : '#BAE8E8' }}>
                  {step.label}
                  {isCurrent && <span style={{ color: '#FFD803', marginLeft: 6 }}>実行中</span>}
                </div>
                <div style={{ fontSize: 11, color: '#BAE8E8' }}>{step.detail}</div>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 20, fontSize: 13, color: '#2D334A', opacity: 0.7 }}>
        ※ 動画の長さや音声の有無によって、数十秒〜数分かかる場合があります
      </div>
    </div>
  )
}

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [video, setVideo] = useState<Video | null>(null)
  const [feature, setFeature] = useState<VideoFeature | null>(null)
  const [candidates, setCandidates] = useState<RuleCandidate[]>([])
  const [reports, setReports] = useState<InspectionReport[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [generatingCandidates, setGeneratingCandidates] = useState(false)
  const [editingOcr, setEditingOcr] = useState(false)
  const [ocrDraft, setOcrDraft] = useState('')
  const [editingTranscription, setEditingTranscription] = useState(false)
  const [transcriptionDraft, setTranscriptionDraft] = useState('')
  const [showFrameDetail, setShowFrameDetail] = useState(false)

  const fetchAll = async () => {
    const [vRes, fRes, cRes, rRes] = await Promise.all([
      fetch(`/api/videos/${id}`),
      fetch(`/api/videos/${id}/features`),
      fetch(`/api/rule-candidates?videoId=${id}`),
      fetch(`/api/inspection-reports?videoId=${id}`),
    ])
    const [v, f, c, r] = await Promise.all([vRes.json(), fRes.json(), cRes.json(), rRes.json()])
    setVideo(v)
    setFeature(f)
    setCandidates(c)
    setReports(r)
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [id])

  // ルール候補生成中はポーリングでステータスを監視（awaiting_review → analyzed）
  useEffect(() => {
    if (!video || !generatingCandidates) return
    const interval = setInterval(async () => {
      const res = await fetch(`/api/videos/${id}`)
      if (!res.ok) return
      const updated: Video = await res.json()
      setVideo(updated)
      if (updated.status === 'analyzed' || updated.status === 'error' || updated.status === 'awaiting_review') {
        clearInterval(interval)
        setGeneratingCandidates(false)
        if (updated.status === 'analyzed') {
          const [cRes, rRes] = await Promise.all([
            fetch(`/api/rule-candidates?videoId=${id}`),
            fetch(`/api/inspection-reports?videoId=${id}`),
          ])
          setCandidates(await cRes.json())
          setReports(await rRes.json())
        }
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [generatingCandidates, id])

  // Stage 1 解析中はポーリングでステータスを監視
  useEffect(() => {
    if (!video || !IN_PROGRESS_STATUSES.includes(video.status)) return
    // downloading は完了タイミングが予測不能なので短め。OCRなど重い処理は長め。
    const pollMs = video.status === 'downloading' ? 2000 : 4000
    const interval = setInterval(async () => {
      const res = await fetch(`/api/videos/${id}`)
      if (!res.ok) return
      const updated: Video = await res.json()
      setVideo(updated)
      if (!IN_PROGRESS_STATUSES.includes(updated.status)) {
        clearInterval(interval)
        if (updated.status === 'analyzed') {
          // 解析完了後に関連データを全取得
          const [fRes, cRes, rRes] = await Promise.all([
            fetch(`/api/videos/${id}/features`),
            fetch(`/api/rule-candidates?videoId=${id}`),
            fetch(`/api/inspection-reports?videoId=${id}`),
          ])
          const [f, c, r] = await Promise.all([fRes.json(), cRes.json(), rRes.json()])
          setFeature(f)
          setCandidates(c)
          setReports(r)
        }
      }
    }, pollMs)
    return () => clearInterval(interval)
  }, [video?.status, id])

  const handleAnalyze = () => {
    // 楽観的UI: 即座にステータスを更新して画面に反映
    setVideo(prev => prev ? { ...prev, status: 'extracting_meta', errorMessage: undefined } : prev)
    // fire-and-forget: ポーリングが進捗を監視する
    fetch(`/api/videos/${id}/features`, { method: 'POST' }).catch(() => {
      setVideo(prev => prev ? {
        ...prev, status: 'error',
        errorMessage: '解析のリクエストに失敗しました。時間をおいてから再試行してください。',
      } : prev)
    })
  }

  const handleCandidateAction = async (candidateId: string, status: 'approved' | 'rejected') => {
    await fetch(`/api/rule-candidates/${candidateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvalStatus: status }),
    })
    await fetchAll()
  }

  const handleDelete = async () => {
    if (!confirm('この動画を削除しますか？')) return
    await fetch(`/api/videos/${id}`, { method: 'DELETE' })
    router.push('/production-rules/sources')
  }

  const handleTitleEdit = () => { setTitleDraft(video?.title ?? ''); setEditingTitle(true) }
  const handleTitleSave = async () => {
    if (!titleDraft.trim()) return
    await fetch(`/api/videos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleDraft.trim() }),
    })
    setEditingTitle(false)
    await fetchAll()
  }

  const handleGenerateCandidates = async () => {
    setGeneratingCandidates(true)
    setVideo(prev => prev ? { ...prev, status: 'generating_candidates' } : prev)
    fetch(`/api/videos/${id}/generate-candidates`, { method: 'POST' }).catch(() => {
      setGeneratingCandidates(false)
    })
  }

  const handleOcrEdit = () => {
    setOcrDraft(feature?.ocrTexts?.join('\n') ?? feature?.textContent ?? '')
    setEditingOcr(true)
  }
  const handleOcrSave = async () => {
    const lines = ocrDraft.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    await fetch(`/api/videos/${id}/features`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ocrTexts: lines }),
    })
    setEditingOcr(false)
    await fetchAll()
  }

  const handleTranscriptionEdit = () => {
    setTranscriptionDraft(feature?.transcription ?? feature?.audioContent ?? '')
    setEditingTranscription(true)
  }
  const handleTranscriptionSave = async () => {
    await fetch(`/api/videos/${id}/features`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcription: transcriptionDraft }),
    })
    setEditingTranscription(false)
    await fetchAll()
  }

  if (loading) return <div style={{ padding: 48, color: '#2D334A' }}>読み込み中...</div>
  if (!video || (video as unknown as { error: string }).error) {
    return <div style={{ padding: 48, color: '#2D334A' }}>動画が見つかりません。</div>
  }

  const isSample = video.type === 'sample'
  const isInProgress = IN_PROGRESS_STATUSES.includes(video.status)
  const isAnalyzed = video.status === 'analyzed'
  const isError = video.status === 'error'
  const isPending = video.status === 'pending'
  const isAwaitingReview = video.status === 'awaiting_review'
  const pendingCandidates = candidates.filter(c => c.approvalStatus === 'pending')

  return (
    <div style={{ padding: 40, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Link href="/production-rules/sources" style={{ color: '#2D334A', fontSize: 13, textDecoration: 'none', opacity: 0.6 }}>← ガイドラインへ戻る</Link>
      </div>

      {/* ヘッダー */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, background: isSample ? '#272343' : '#BAE8E8', color: isSample ? '#FFD803' : '#272343', padding: '3px 10px', borderRadius: 20 }}>
              {isSample ? 'お手本動画' : '検査する動画'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: isAnalyzed ? '#27ae60' : isError ? '#e74c3c' : isInProgress ? '#f39c12' : '#999' }}>
              {STATUS_LABELS[video.status] ?? video.status}
            </span>
          </div>
          {editingTitle ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
              <input
                autoFocus value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleTitleSave(); if (e.key === 'Escape') setEditingTitle(false) }}
                style={{ fontSize: 22, fontWeight: 700, color: '#272343', border: '2px solid #BAE8E8', borderRadius: 8, padding: '4px 10px', outline: 'none', width: 400 }}
              />
              <button onClick={handleTitleSave} style={{ background: '#272343', color: '#FFD803', border: 'none', borderRadius: 7, padding: '6px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>保存</button>
              <button onClick={() => setEditingTitle(false)} style={{ background: 'transparent', color: '#999', border: '1px solid #ddd', borderRadius: 7, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}>キャンセル</button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: '#272343', margin: 0 }}>{video.title}</h1>
              <button onClick={handleTitleEdit} style={{ background: 'transparent', border: '1px solid #E3F6F5', borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#999', cursor: 'pointer' }}>編集</button>
            </div>
          )}
          {/* 取得元情報 */}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {video.url && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#BAE8E8', minWidth: 72, paddingTop: 2 }}>取得元URL</span>
                <a
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: '#2D334A', opacity: 0.75, wordBreak: 'break-all', textDecoration: 'underline dotted' }}
                >
                  {video.url}
                </a>
              </div>
            )}
            {video.filePath && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#BAE8E8', minWidth: 72 }}>ファイル名</span>
                <span style={{ fontSize: 13, color: '#2D334A', opacity: 0.75 }}>
                  📎 {video.filePath.split('/').pop()}
                </span>
              </div>
            )}
          </div>
        </div>
        <button onClick={handleDelete} style={{ background: 'transparent', border: '1px solid #ff6b6b', color: '#ff6b6b', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
          削除
        </button>
      </div>

      {/* エラー表示 */}
      {isError && (
        <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: 12, padding: '20px 24px', marginBottom: 32 }}>
          <div style={{ fontWeight: 700, color: '#c0392b', fontSize: 15, marginBottom: 8 }}>
            ⚠️ 解析に失敗しました
          </div>
          <div style={{ color: '#c0392b', fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
            {video.errorMessage || '解析中にエラーが発生しました。時間をおいてから再試行してください。'}
          </div>
          <button
            onClick={handleAnalyze}
            style={{ background: '#272343', color: '#FFD803', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
          >
            再試行する
          </button>
        </div>
      )}

      {/* 解析前：解析開始ボタン */}
      {isPending && (
        <div style={{ background: '#E3F6F5', borderRadius: 12, padding: 28, marginBottom: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#2D334A', marginBottom: 16 }}>
            {isSample
              ? 'この動画を解析して、検品ルールの候補を生成します。'
              : 'この動画を解析して、検品ルールと照合できるようにします。'}
          </div>
          <button
            onClick={handleAnalyze}
            style={{ background: '#272343', color: '#FFD803', border: 'none', borderRadius: 8, padding: '12px 28px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            動画を解析する
          </button>
        </div>
      )}

      {/* ダウンロード中 */}
      {video.status === 'downloading' && <DownloadProgress />}

      {/* 解析中：ステップ表示（ダウンロード以外の処理中） */}
      {isInProgress && video.status !== 'downloading' && (
        <AnalysisProgress status={video.status} isSample={isSample} />
      )}

      {/* Stage 1 完了・ユーザー確認待ち */}
      {isAwaitingReview && isSample && (
        <div style={{ background: '#fff', border: '2px solid #FFD803', borderRadius: 14, padding: '24px 28px', marginBottom: 32 }}>
          <div style={{ fontWeight: 700, color: '#272343', fontSize: 16, marginBottom: 8 }}>
            ✅ テキスト解析が完了しました
          </div>
          <div style={{ fontSize: 14, color: '#2D334A', lineHeight: 1.7, marginBottom: 20 }}>
            OCR・音声文字起こしの結果を確認してください。<br />
            誤認識があれば「手直し」で修正してから、AI解析を実行できます。
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={handleGenerateCandidates}
              disabled={generatingCandidates || editingOcr || editingTranscription}
              style={{
                background: generatingCandidates || editingOcr || editingTranscription ? '#ccc' : '#272343',
                color: '#FFD803',
                border: 'none',
                borderRadius: 8,
                padding: '12px 24px',
                fontWeight: 700,
                fontSize: 15,
                cursor: generatingCandidates || editingOcr || editingTranscription ? 'default' : 'pointer',
              }}
            >
              {generatingCandidates ? '生成中...' : '💡 AI解析を実行（ルール候補を生成）'}
            </button>
            {(editingOcr || editingTranscription) && (
              <span style={{ fontSize: 13, color: '#f39c12' }}>
                ⚠️ 手直し中の内容を保存してから実行してください
              </span>
            )}
          </div>
        </div>
      )}

      {/* 解析結果：動画の特徴 */}
      {feature && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', marginBottom: 16 }}>動画の特徴</h2>
          <div style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 12, padding: 24 }}>
            {feature.meta && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #E3F6F5' }}>
                {[
                  { label: '尺', value: `${feature.meta.duration}秒` },
                  { label: '解像度', value: `${feature.meta.width}×${feature.meta.height}` },
                  { label: 'FPS', value: `${feature.meta.fps}` },
                  { label: 'コーデック', value: feature.meta.videoCodec },
                  { label: 'ビットレート', value: `${feature.meta.bitrate}kbps` },
                  { label: '音声', value: feature.meta.hasAudio ? `あり (${feature.meta.audioCodec ?? '不明'})` : 'なし' },
                ].map(item => (
                  <div key={item.label}>
                    <div style={{ fontSize: 11, color: '#999', fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                    <div style={{ fontSize: 14, color: '#272343', fontWeight: 600 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* OCR テキスト */}
              {(feature.ocrTexts?.length || feature.textContent) ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#999', fontWeight: 700 }}>🔤 画面テキスト（OCR）</span>
                    <span style={{ fontSize: 11, color: '#BAE8E8' }}>
                      {feature.ocrTexts?.length ?? 0} 種類のテキストを検出
                    </span>
                    <button
                      onClick={editingOcr ? handleOcrSave : handleOcrEdit}
                      style={{ marginLeft: 'auto', background: editingOcr ? '#272343' : 'transparent', color: editingOcr ? '#FFD803' : '#BAE8E8', border: `1px solid ${editingOcr ? '#272343' : '#BAE8E8'}`, borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: editingOcr ? 700 : 400 }}
                    >
                      {editingOcr ? '保存' : '手直し'}
                    </button>
                    {editingOcr && (
                      <button onClick={() => setEditingOcr(false)} style={{ background: 'transparent', border: '1px solid #ddd', color: '#999', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                        キャンセル
                      </button>
                    )}
                  </div>
                  {editingOcr ? (
                    <textarea
                      autoFocus
                      value={ocrDraft}
                      onChange={e => setOcrDraft(e.target.value)}
                      rows={6}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #BAE8E8', fontSize: 13, color: '#272343', resize: 'vertical', lineHeight: 1.7, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                      placeholder="1行1テキストで記入してください"
                    />
                  ) : (
                    <div style={{ background: '#F5FCFC', borderRadius: 8, padding: '12px 14px' }}>
                      {(feature.ocrTexts ?? (feature.textContent ? [feature.textContent] : [])).map((t, i) => (
                        <div key={i} style={{ fontSize: 13, color: '#272343', lineHeight: 1.8, borderBottom: i < (feature.ocrTexts?.length ?? 1) - 1 ? '1px solid #E3F6F5' : 'none', paddingBottom: 4, marginBottom: 4 }}>
                          {t}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* フレームごとの詳細（折りたたみ） */}
                  {!editingOcr && feature.frames && feature.frames.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        onClick={() => setShowFrameDetail(!showFrameDetail)}
                        style={{ background: 'transparent', border: 'none', color: '#BAE8E8', fontSize: 12, cursor: 'pointer', padding: 0 }}
                      >
                        {showFrameDetail ? '▲ フレーム詳細を閉じる' : '▼ フレームごとの詳細を見る'}
                      </button>
                      {showFrameDetail && (
                        <div style={{ marginTop: 8, border: '1px solid #E3F6F5', borderRadius: 8, overflow: 'hidden' }}>
                          {feature.frames.filter(f => f.ocrText.length > 0).slice(0, 20).map((f, i) => (
                            <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 12px', borderBottom: '1px solid #F0FAFA', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: 11, color: '#BAE8E8', fontWeight: 700, minWidth: 48, flexShrink: 0 }}>
                                {Math.floor(f.timestamp / 60)}:{String(f.timestamp % 60).padStart(2, '0')}
                              </span>
                              <span style={{ fontSize: 12, color: '#272343', lineHeight: 1.6 }}>{f.ocrText}</span>
                            </div>
                          ))}
                          {feature.frames.filter(f => f.ocrText.length > 0).length > 20 && (
                            <div style={{ padding: '8px 12px', fontSize: 12, color: '#BAE8E8' }}>
                              …他 {feature.frames.filter(f => f.ocrText.length > 0).length - 20} フレーム
                            </div>
                          )}
                          {feature.frames.filter(f => f.ocrText.length > 0).length === 0 && (
                            <div style={{ padding: '8px 12px', fontSize: 12, color: '#BAE8E8' }}>
                              テキストが検出されたフレームはありません
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}

              {/* 音声文字起こし */}
              {(feature.transcription || feature.audioContent) ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#999', fontWeight: 700 }}>🎙️ 音声文字起こし（Whisper）</span>
                    <span style={{ fontSize: 11, color: '#BAE8E8' }}>
                      {(feature.transcription || feature.audioContent || '').length} 文字
                    </span>
                    <button
                      onClick={editingTranscription ? handleTranscriptionSave : handleTranscriptionEdit}
                      style={{ marginLeft: 'auto', background: editingTranscription ? '#272343' : 'transparent', color: editingTranscription ? '#FFD803' : '#BAE8E8', border: `1px solid ${editingTranscription ? '#272343' : '#BAE8E8'}`, borderRadius: 6, padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: editingTranscription ? 700 : 400 }}
                    >
                      {editingTranscription ? '保存' : '手直し'}
                    </button>
                    {editingTranscription && (
                      <button onClick={() => setEditingTranscription(false)} style={{ background: 'transparent', border: '1px solid #ddd', color: '#999', borderRadius: 6, padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>
                        キャンセル
                      </button>
                    )}
                  </div>
                  {editingTranscription ? (
                    <textarea
                      autoFocus
                      value={transcriptionDraft}
                      onChange={e => setTranscriptionDraft(e.target.value)}
                      rows={8}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #BAE8E8', fontSize: 13, color: '#272343', resize: 'vertical', lineHeight: 1.8, fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }}
                    />
                  ) : feature.transcriptChunks && feature.transcriptChunks.length > 0 ? (
                    // タイムスタンプ付きセグメント表示（OCRフレーム詳細と同じ形式）
                    <div style={{ border: '1px solid #E3F6F5', borderRadius: 8, overflow: 'hidden' }}>
                      {feature.transcriptChunks.map((chunk, i) => (
                        <div key={i} style={{
                          display: 'flex', gap: 12, padding: '8px 12px',
                          borderBottom: i < feature.transcriptChunks!.length - 1 ? '1px solid #F0FAFA' : 'none',
                          alignItems: 'flex-start',
                          background: '#F5FCFC',
                        }}>
                          <span style={{ fontSize: 11, color: '#BAE8E8', fontWeight: 700, minWidth: 48, flexShrink: 0 }}>
                            {Math.floor(chunk.start / 60)}:{String(Math.floor(chunk.start % 60)).padStart(2, '0')}
                          </span>
                          <span style={{ fontSize: 13, color: '#272343', lineHeight: 1.7 }}>{chunk.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // タイムスタンプなし（旧データ）はプレーンテキストで表示
                    <div style={{ background: '#F5FCFC', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#272343', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
                      {feature.transcription || feature.audioContent}
                    </div>
                  )}
                </div>
              ) : null}

              {/* OCRも文字起こしもない場合 */}
              {!feature.ocrTexts?.length && !feature.textContent && !feature.transcription && !feature.audioContent && (
                <div style={{ fontSize: 13, color: '#BAE8E8' }}>
                  テキスト・音声は検出されませんでした
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      {/* ルール候補（お手本動画のみ） */}
      {isSample && candidates.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', marginBottom: 6 }}>
            ルール候補 ({candidates.length}件)
          </h2>
          <p style={{ fontSize: 13, color: '#2D334A', marginBottom: 16 }}>
            AIが提案したルール候補です。確認して承認または却下してください。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {candidates.map(c => (
              <div key={c.id} style={{
                background: c.approvalStatus === 'approved' ? '#f0fff4' : c.approvalStatus === 'rejected' ? '#fff0f0' : '#fff',
                border: `1px solid ${c.approvalStatus === 'approved' ? '#BAE8E8' : c.approvalStatus === 'rejected' ? '#ffcccc' : '#E3F6F5'}`,
                borderRadius: 10, padding: '16px 20px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, background: '#272343', color: '#FFD803', padding: '2px 8px', borderRadius: 4, display: 'inline-block', marginBottom: 8 }}>
                      {c.category}
                    </span>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#272343', marginBottom: 6, lineHeight: 1.5 }}>{c.content}</div>
                    <div style={{ fontSize: 13, color: '#2D334A' }}>根拠: {c.reason}</div>
                  </div>
                  {c.approvalStatus === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, marginLeft: 16, flexShrink: 0 }}>
                      <button onClick={() => handleCandidateAction(c.id, 'approved')} style={{ background: '#272343', color: '#FFD803', border: 'none', borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>承認</button>
                      <button onClick={() => handleCandidateAction(c.id, 'rejected')} style={{ background: '#fff', color: '#999', border: '1px solid #ddd', borderRadius: 6, padding: '6px 14px', fontSize: 13, cursor: 'pointer' }}>却下</button>
                    </div>
                  )}
                  {c.approvalStatus === 'approved' && <span style={{ fontSize: 12, fontWeight: 700, color: '#27ae60', marginLeft: 16 }}>✓ 承認済</span>}
                  {c.approvalStatus === 'rejected' && <span style={{ fontSize: 12, fontWeight: 700, color: '#e74c3c', marginLeft: 16 }}>✗ 却下</span>}
                </div>
              </div>
            ))}
          </div>
          {pendingCandidates.length > 0 && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#FFF8DC', borderRadius: 8, fontSize: 13, color: '#2D334A' }}>
              💡 承認したルールは自動的に「検品ルール」に追加されます。
            </div>
          )}
        </section>
      )}

      {/* 検品ボタン（検査動画のみ） */}
      {!isSample && isAnalyzed && (
        <section style={{ marginBottom: 32 }}>
          <div style={{ background: '#272343', borderRadius: 12, padding: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#FFD803', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>🔍 検品ルールで検査する</div>
              <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>登録されたルールとこの動画を照合して検査レポートを作成します。</div>
            </div>
            <Link href="/inspections" style={{ background: '#FFD803', color: '#272343', fontWeight: 700, padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontSize: 14, whiteSpace: 'nowrap' }}>
              検査を実行 →
            </Link>
          </div>
        </section>
      )}

      {/* 検査レポート履歴 */}
      {reports.length > 0 && (
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', marginBottom: 16 }}>検査レポート履歴</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {reports.map(report => (
              <div key={report.id} style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 10, padding: '16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 14, color: '#272343' }}>{report.comments}</div>
                  <div style={{ fontSize: 12, color: '#999' }}>{new Date(report.createdAt).toLocaleDateString('ja-JP')}</div>
                </div>
                {report.issues.length > 0 && <div style={{ marginTop: 8, fontSize: 13, color: '#c0392b' }}>問題: {report.issues.length}件</div>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
