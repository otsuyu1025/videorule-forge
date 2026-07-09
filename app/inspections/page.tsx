'use client'

import { useState, useEffect, useRef } from 'react'
import type { VideoInspection, InspectionResult, FrameData } from '@/types'

type Step = 'idle' | 'registering' | 'analyzing' | 'inspecting' | 'done' | 'error'
type InputMode = 'url' | 'file'

const VIDEO_STAGE_LABELS: Record<string, string> = {
  extracting_meta:      '動画情報を取得中...',
  extracting_frames:    'フレームを抽出中...',
  running_ocr:          'テキストを読み取り中（OCR）...',
  transcribing:         '音声を文字起こし中...',
  generating_candidates:'ルール候補を生成中...',
}

/** テロップ表示タイムラインをクライアントサイドで構築 */
function buildTelopTimeline(frames: FrameData[], frameInterval: number): string {
  const segments: Array<{ text: string; startTime: number; frameCount: number }> = []
  for (const frame of frames) {
    const text = frame.ocrText.trim()
    const last = segments[segments.length - 1]
    if (last && last.text === text) {
      last.frameCount++
    } else {
      segments.push({ text, startTime: frame.timestamp, frameCount: 1 })
    }
  }
  const textSegments = segments.filter(s => s.text.length > 0)
  if (textSegments.length === 0) return ''
  return textSegments.map(s => {
    const duration = s.frameCount * frameInterval
    const endTime = s.startTime + duration
    return `${s.startTime}秒〜${endTime}秒（${duration}秒間）: 「${s.text}」`
  }).join('\n')
}

function OcrPanel({ frames, frameInterval }: { frames: FrameData[]; frameInterval: number }) {
  const [open, setOpen] = useState(false)

  const framesWithText = frames.filter(f => f.ocrText.trim().length > 0)
  const telopTimeline = buildTelopTimeline(frames, frameInterval)

  return (
    <div style={{ marginTop: 16, borderTop: '1px solid #E3F6F5', paddingTop: 14 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 700, color: '#272343', padding: 0,
        }}
      >
        <span style={{ fontSize: 12, color: '#BAE8E8' }}>{open ? '▲' : '▼'}</span>
        OCR解析詳細
        <span style={{ fontSize: 11, fontWeight: 400, color: '#999', marginLeft: 4 }}>
          ({framesWithText.length}/{frames.length}フレームでテキスト検出)
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          {telopTimeline ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2D334A', marginBottom: 6 }}>
                テロップ表示タイムライン
              </div>
              <div style={{
                background: '#F5FCFC', border: '1px solid #E3F6F5', borderRadius: 8,
                padding: '10px 14px', marginBottom: 14,
              }}>
                {telopTimeline.split('\n').map((line, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#272343', lineHeight: 1.8 }}>{line}</div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: '#999', marginBottom: 14 }}>
              テロップ（継続表示）は検出されませんでした
            </div>
          )}

          <div style={{ fontSize: 12, fontWeight: 700, color: '#2D334A', marginBottom: 6 }}>
            フレーム別OCR結果
          </div>
          <div style={{
            background: '#FAFAFA', border: '1px solid #E3F6F5', borderRadius: 8,
            padding: '10px 14px', maxHeight: 240, overflowY: 'auto',
          }}>
            {frames.map((f, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, fontSize: 12, lineHeight: 1.7,
                borderBottom: i < frames.length - 1 ? '1px solid #f0f0f0' : 'none',
                paddingBottom: 2, marginBottom: 2,
              }}>
                <span style={{
                  color: '#BAE8E8', flexShrink: 0, width: 44, textAlign: 'right',
                }}>
                  {f.timestamp}秒
                </span>
                <span style={{ color: f.ocrText.trim() ? '#272343' : '#ccc' }}>
                  {f.ocrText.trim() || '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function JudgmentBadge({ judgment }: { judgment: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    'OK': { bg: '#d4edda', color: '#155724' },
    'NG': { bg: '#f8d7da', color: '#721c24' },
    '要確認': { bg: '#fff3cd', color: '#856404' },
  }
  const c = colors[judgment] || { bg: '#E3F6F5', color: '#272343' }
  return (
    <span style={{ background: c.bg, color: c.color, padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
      {judgment}
    </span>
  )
}

function StepIndicator({ current, step, label }: { current: Step; step: Step; label: string }) {
  const steps: Step[] = ['registering', 'analyzing', 'inspecting', 'done']
  const currentIdx = steps.indexOf(current)
  const stepIdx = steps.indexOf(step)
  const isDone = currentIdx > stepIdx
  const isActive = current === step

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isDone ? '#272343' : isActive ? '#FFD803' : '#E3F6F5',
        color: isDone ? '#FFD803' : isActive ? '#272343' : '#BAE8E8',
        fontWeight: 700, fontSize: 12, flexShrink: 0,
      }}>
        {isDone ? '✓' : stepIdx + 1}
      </div>
      <span style={{ fontSize: 13, color: isDone ? '#272343' : isActive ? '#272343' : '#BAE8E8', fontWeight: isActive ? 700 : 400 }}>
        {label}
        {isActive && <span style={{ marginLeft: 6 }}>...</span>}
      </span>
    </div>
  )
}

export default function InspectionsPage() {
  const [inputMode, setInputMode] = useState<InputMode>('url')
  const [form, setForm] = useState({ title: '', url: '' })
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [latestInspection, setLatestInspection] = useState<VideoInspection | null>(null)
  const [latestVideoTitle, setLatestVideoTitle] = useState('')
  const [latestFrames, setLatestFrames] = useState<FrameData[]>([])
  const [history, setHistory] = useState<Array<{ inspection: VideoInspection; videoTitle: string }>>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [framesByVideoId, setFramesByVideoId] = useState<Record<string, FrameData[]>>({})
  const [transcriptionDisabled, setTranscriptionDisabled] = useState(false)
  const [frameIntervalSeconds, setFrameIntervalSeconds] = useState(1)
  const [analysisProgress, setAnalysisProgress] = useState<{ stage: string; current: number; total: number } | null>(null)
  const [videoStageLabel, setVideoStageLabel] = useState<string>('')
  const progressPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchHistory = async () => {
    const [inspRes, videosRes] = await Promise.all([
      fetch('/api/inspections'),
      fetch('/api/videos?type=inspection'),
    ])
    const inspections: VideoInspection[] = await inspRes.json()
    const videos: Array<{ id: string; title: string }> = await videosRes.json()
    const videoMap = Object.fromEntries(videos.map(v => [v.id, v.title]))
    setHistory(
      inspections
        .filter(i => i.status === 'completed' || i.status === 'running' || i.status === 'error')
        .map(i => ({ inspection: i, videoTitle: videoMap[i.videoId] || '不明な動画' }))
    )
  }

  // 展開時にフレームデータを取得してキャッシュ
  const handleExpand = async (inspectionId: string, videoId: string) => {
    setExpandedId(prev => prev === inspectionId ? null : inspectionId)
    if (framesByVideoId[videoId]) return
    const res = await fetch(`/api/videos/${videoId}/features`)
    if (!res.ok) return
    const feature = await res.json().catch(() => null)
    if (feature?.frames && Array.isArray(feature.frames)) {
      setFramesByVideoId(prev => ({ ...prev, [videoId]: feature.frames as FrameData[] }))
    }
  }

  useEffect(() => {
    fetchHistory()
    fetch('/api/features').then(r => r.json()).then(f => {
      setTranscriptionDisabled(f.transcriptionDisabled === true)
      if (typeof f.frameIntervalSeconds === 'number') setFrameIntervalSeconds(f.frameIntervalSeconds)
    })
  }, [])

  // 検証中の検品がある間は5秒ごとに履歴を更新
  useEffect(() => {
    const hasRunning = history.some(h => h.inspection.status === 'running')
    if (!hasRunning) return
    const timer = setInterval(fetchHistory, 5000)
    return () => clearInterval(timer)
  }, [history])

  const handleInspect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inputMode === 'file' && !file) { setErrorMsg('ファイルを選択してください'); return }
    setStep('registering')
    setErrorMsg('')
    setLatestInspection(null)

    try {
      let videoRes: Response
      if (inputMode === 'file' && file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('title', form.title || file.name.replace(/\.[^.]+$/, ''))
        fd.append('type', 'inspection')
        videoRes = await fetch('/api/videos', { method: 'POST', body: fd })
      } else {
        videoRes = await fetch('/api/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: form.title, type: 'inspection', url: form.url }),
        })
      }
      if (!videoRes.ok) {
        const body = await videoRes.json().catch(() => ({})) as Record<string, unknown>
        throw new Error(
          (typeof body.error === 'string' && body.error) ||
          (typeof body.message === 'string' && body.message) ||
          '動画の登録に失敗しました'
        )
      }
      const video = await videoRes.json()
      const videoTitle = video.title

      setStep('analyzing')
      setAnalysisProgress(null)
      setVideoStageLabel('')
      // 動画解析中はポーリングでステージ・進捗を取得
      progressPollRef.current = setInterval(async () => {
        const res = await fetch(`/api/videos/${video.id}`).catch(() => null)
        if (!res?.ok) return
        const vd = await res.json().catch(() => null)
        if (vd?.analysisProgress) setAnalysisProgress(vd.analysisProgress)
        if (vd?.status && VIDEO_STAGE_LABELS[vd.status]) {
          setVideoStageLabel(VIDEO_STAGE_LABELS[vd.status])
        }
      }, 2000)

      const featureRes = await fetch(`/api/videos/${video.id}/features`, { method: 'POST' })
        .catch(() => null)
      clearInterval(progressPollRef.current)
      progressPollRef.current = null
      setAnalysisProgress(null)

      let featureData: Record<string, unknown> | null = null

      if (featureRes?.ok) {
        featureData = await featureRes.json().catch(() => null)
        setVideoStageLabel('')
      } else {
        // Railway HTTP タイムアウト or ネットワークエラー → サーバーは処理中の可能性があるためポーリング
        // まず即座に動画ステータスを確認（サーバーが既にエラー/完了を書き込んでいる場合に備えて）
        const initRes = await fetch(`/api/videos/${video.id}`).catch(() => null)
        const initVd = initRes?.ok ? await initRes.json().catch(() => null) : null

        if (initVd?.status === 'error') {
          throw new Error(
            (typeof initVd.errorMessage === 'string' && initVd.errorMessage) ||
            '動画の解析に失敗しました。時間をおいて再試行してください。'
          )
        } else if (initVd?.status === 'analyzed') {
          const fRes = await fetch(`/api/videos/${video.id}/features`).catch(() => null)
          featureData = fRes?.ok ? await fRes.json().catch(() => null) : null
        } else {
          // まだ処理中（またはOOMでフリーズ中）→ 最大3分間ポーリング
          const ANALYSIS_MAX_WAIT = 3 * 60 * 1000
          const analysisStarted = Date.now()
          let analysisResolved = false

          while (!analysisResolved && Date.now() - analysisStarted < ANALYSIS_MAX_WAIT) {
            await new Promise(r => setTimeout(r, 3000))
            const vRes = await fetch(`/api/videos/${video.id}`).catch(() => null)
            const vd = vRes?.ok ? await vRes.json().catch(() => null) : null
            if (!vd) continue

            if (vd.status && VIDEO_STAGE_LABELS[vd.status]) {
              setVideoStageLabel(VIDEO_STAGE_LABELS[vd.status])
            }

            if (vd.status === 'analyzed') {
              const fRes = await fetch(`/api/videos/${video.id}/features`).catch(() => null)
              featureData = fRes?.ok ? await fRes.json().catch(() => null) : null
              analysisResolved = true
            } else if (vd.status === 'error') {
              throw new Error(
                (typeof vd.errorMessage === 'string' && vd.errorMessage) ||
                '動画の解析に失敗しました。時間をおいて再試行してください。'
              )
            }
          }

          if (!analysisResolved) {
            const vRes = await fetch(`/api/videos/${video.id}`).catch(() => null)
            const vd = vRes?.ok ? await vRes.json().catch(() => null) : null
            const stageLabel = (vd?.status && VIDEO_STAGE_LABELS[vd.status])
              ? `（${VIDEO_STAGE_LABELS[vd.status].replace('...', '')} 中）`
              : ''
            throw new Error(`動画の解析がタイムアウトしました${stageLabel}。時間をおいて再試行してください。`)
          }
        }

        setVideoStageLabel('')
      }

      if (featureData?.frames && Array.isArray(featureData.frames)) {
        setLatestFrames(featureData.frames as FrameData[])
      } else {
        setLatestFrames([])
      }

      setStep('inspecting')
      const inspectionRes = await fetch('/api/inspections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video.id }),
      })
      if (!inspectionRes.ok) {
        const body = await inspectionRes.json().catch(() => ({})) as Record<string, unknown>
        throw new Error(
          (typeof body.error === 'string' && body.error) ||
          (typeof body.message === 'string' && body.message) ||
          '検品に失敗しました'
        )
      }

      const { inspection } = await inspectionRes.json()
      setLatestInspection(inspection)
      setLatestVideoTitle(videoTitle)
      setStep('done')
      setForm({ title: '', url: '' })
      setFile(null)
      fetchHistory()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '検品に失敗しました。時間をおいてからもう一度お試しください。')
      setStep('error')
    }
  }

  const handleDelete = async (e: { stopPropagation(): void }, inspectionId: string, isStuck: boolean) => {
    e.stopPropagation()
    const msg = isStuck
      ? '検証中のまま止まっている検品を削除しますか？'
      : 'この検品履歴を削除しますか？この操作は元に戻せません。'
    if (!confirm(msg)) return
    await fetch(`/api/inspections/${inspectionId}`, { method: 'DELETE' })
    if (expandedId === inspectionId) setExpandedId(null)
    setHistory(prev => prev.filter(h => h.inspection.id !== inspectionId))
  }

  const handleHumanOverride = async (inspectionId: string, result: InspectionResult, override: string) => {
    await fetch(`/api/inspections/${inspectionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId: result.ruleId, humanOverride: override }),
    })
    const updated = await fetch(`/api/inspections/${inspectionId}`).then(r => r.json())
    if (latestInspection?.id === inspectionId) setLatestInspection(updated)
    setHistory(prev => prev.map(h =>
      h.inspection.id === inspectionId ? { ...h, inspection: updated } : h
    ))
  }

  const isRunning = ['registering', 'analyzing', 'inspecting'].includes(step)

  const renderResults = (inspection: VideoInspection) => {
    const okCount = inspection.results.filter(r => (r.humanOverride || r.judgment) === 'OK').length
    const ngCount = inspection.results.filter(r => (r.humanOverride || r.judgment) === 'NG').length
    const reviewCount = inspection.results.filter(r => (r.humanOverride || r.judgment) === '要確認').length

    return (
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 13, background: '#d4edda', color: '#155724', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>OK {okCount}</span>
          {ngCount > 0 && <span style={{ fontSize: 13, background: '#f8d7da', color: '#721c24', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>NG {ngCount}</span>}
          {reviewCount > 0 && <span style={{ fontSize: 13, background: '#fff3cd', color: '#856404', padding: '4px 12px', borderRadius: 20, fontWeight: 700 }}>要確認 {reviewCount}</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {inspection.results.map(result => {
            const effective = result.humanOverride || result.judgment
            return (
              <div key={result.ruleId} style={{ background: '#FAFAFA', border: '1px solid #E3F6F5', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: '#272343', fontWeight: 600, marginBottom: 4, lineHeight: 1.5 }}>{result.ruleContent}</div>
                    <div style={{ fontSize: 12, color: '#2D334A', opacity: 0.75 }}>{result.reason}</div>
                    <div style={{ fontSize: 11, color: '#BAE8E8', marginTop: 4 }}>AI確信度: {Math.round((result.confidence || 0) * 100)}%</div>
                  </div>
                  <div style={{ marginLeft: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <JudgmentBadge judgment={effective} />
                    <div style={{ display: 'flex', gap: 3 }}>
                      {(['OK', 'NG', '要確認'] as const).map(j => (
                        <button key={j} onClick={() => handleHumanOverride(inspection.id, result, j)} style={{
                          fontSize: 11, padding: '2px 7px', borderRadius: 4,
                          border: '1px solid #ddd',
                          background: effective === j ? '#272343' : '#fff',
                          color: effective === j ? '#FFD803' : '#999',
                          cursor: 'pointer',
                        }}>{j}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 48, maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
          Video Inspection
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, color: '#272343', margin: 0 }}>動画検品</h1>
        <p style={{ color: '#2D334A', marginTop: 10, fontSize: 15, lineHeight: 1.7, opacity: 0.8 }}>
          動画URLを入力して、動画制作ルールと照合します。
        </p>
      </div>

      {transcriptionDisabled && (
        <div style={{ background: '#FFF9E6', border: '1px solid #FFD803', borderRadius: 10, padding: '12px 18px', marginBottom: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <div style={{ fontSize: 13, color: '#272343', lineHeight: 1.7 }}>
            <strong>音声文字起こしは現在無効です。</strong><br />
            動画の映像・テキスト（字幕・テロップ）は解析されますが、ナレーションや会話の内容はルール判定に使用されません。
          </div>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #E3F6F5', borderRadius: 16, padding: '32px 36px', marginBottom: 32 }}>
        <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #E3F6F5' }}>
          {(['url', 'file'] as InputMode[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setInputMode(m); setErrorMsg('') }}
              disabled={isRunning}
              style={{
                padding: '8px 20px', border: 'none', background: 'transparent',
                fontSize: 14, fontWeight: inputMode === m ? 700 : 400,
                color: inputMode === m ? '#272343' : '#999',
                borderBottom: inputMode === m ? '2px solid #272343' : 'none',
                cursor: isRunning ? 'default' : 'pointer', marginBottom: -2,
              }}
            >
              {m === 'url' ? '🔗 URLで検品' : '📁 ファイルで検品'}
            </button>
          ))}
        </div>

        <form onSubmit={handleInspect} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 8 }}>動画タイトル</label>
            <input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder={inputMode === 'file' ? '省略するとファイル名が使われます' : '例: 2024年春 商品プロモーション動画'}
              disabled={isRunning}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #E3F6F5', fontSize: 15, color: '#272343', boxSizing: 'border-box', outline: 'none' }}
              onFocus={e => { e.target.style.borderColor = '#BAE8E8' }}
              onBlur={e => { e.target.style.borderColor = '#E3F6F5' }}
            />
          </div>

          {inputMode === 'url' ? (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 8 }}>動画URL</label>
              <input
                type="url"
                required
                value={form.url}
                onChange={e => setForm({ ...form, url: e.target.value })}
                placeholder="https://example.com/video.mp4"
                disabled={isRunning}
                style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid #E3F6F5', fontSize: 15, color: '#272343', boxSizing: 'border-box', outline: 'none' }}
                onFocus={e => { e.target.style.borderColor = '#BAE8E8' }}
                onBlur={e => { e.target.style.borderColor = '#E3F6F5' }}
              />
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#272343', marginBottom: 8 }}>動画ファイル</label>
              <div
                onClick={() => !isRunning && fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${file ? '#272343' : '#BAE8E8'}`,
                  borderRadius: 10, padding: '24px 20px', textAlign: 'center',
                  cursor: isRunning ? 'default' : 'pointer',
                  background: file ? '#F5FCFC' : '#FAFAFA',
                }}
              >
                {file ? (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🎬</div>
                    <div style={{ fontWeight: 700, color: '#272343', fontSize: 15 }}>{file.name}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                    {!isRunning && <div style={{ fontSize: 12, color: '#BAE8E8', marginTop: 8 }}>クリックして変更</div>}
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>📂</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#272343', marginBottom: 4 }}>
                      クリックしてファイルを選択
                    </div>
                    <div style={{ fontSize: 12, color: '#999' }}>
                      MP4 / MOV / AVI / WebM
                    </div>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.mov,.avi,.webm,.mkv"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null
                  setFile(f)
                  if (f && !form.title) setForm(prev => ({ ...prev, title: f.name.replace(/\.[^.]+$/, '') }))
                }}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {isRunning && (
            <div style={{ background: '#F5FCFC', borderRadius: 10, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <StepIndicator current={step} step="registering" label="動画を登録中" />
              <div>
                <StepIndicator current={step} step="analyzing" label="AIが動画を解析中" />
                {step === 'analyzing' && (videoStageLabel || analysisProgress) && (
                  <div style={{ marginTop: 5, marginLeft: 36, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {videoStageLabel && !analysisProgress && (
                      <div style={{ fontSize: 12, color: '#999' }}>{videoStageLabel}</div>
                    )}
                    {analysisProgress && (
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {analysisProgress.stage === 'ocr' ? 'テキスト認識（OCR）' : 'Vision OCR 補正'}:
                        {' '}{analysisProgress.current} / {analysisProgress.total} フレーム完了
                      </div>
                    )}
                  </div>
                )}
              </div>
              <StepIndicator current={step} step="inspecting" label="動画制作ルールと照合中" />
            </div>
          )}

          {step === 'error' && (
            <div style={{ padding: '12px 16px', background: '#fff0f0', borderRadius: 8, color: '#c0392b', fontSize: 14 }}>
              {errorMsg}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isRunning}
              style={{
                background: isRunning ? '#ccc' : '#272343',
                color: '#FFD803', border: 'none', borderRadius: 8,
                padding: '14px 32px', fontWeight: 700, fontSize: 15,
                cursor: isRunning ? 'default' : 'pointer',
              }}
            >
              {isRunning ? '検品中...' : '🔍 検品する'}
            </button>
          </div>
        </form>
      </div>

      {step === 'done' && latestInspection && (
        <div style={{ background: '#fff', border: '2px solid #272343', borderRadius: 16, padding: '28px 32px', marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#272343', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>
                Latest Result
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#272343' }}>{latestVideoTitle}</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#272343', background: '#FFD803', padding: '4px 12px', borderRadius: 20 }}>完了</span>
          </div>
          {renderResults(latestInspection)}
          {latestFrames.length > 0 && (
            <OcrPanel frames={latestFrames} frameInterval={frameIntervalSeconds} />
          )}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#272343', marginBottom: 16 }}>検品履歴</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map(({ inspection, videoTitle }) => {
              const isRunning = inspection.status === 'running'
              const isError = inspection.status === 'error'
              const okCount = inspection.results.filter(r => (r.humanOverride || r.judgment) === 'OK').length
              const ngCount = inspection.results.filter(r => (r.humanOverride || r.judgment) === 'NG').length
              const reviewCount = inspection.results.filter(r => (r.humanOverride || r.judgment) === '要確認').length
              const isExpanded = expandedId === inspection.id
              const historyFrames = framesByVideoId[inspection.videoId] || []

              return (
                <div key={inspection.id} style={{ background: '#fff', border: `1px solid ${isRunning ? '#FFD803' : '#E3F6F5'}`, borderRadius: 12, overflow: 'hidden' }}>
                  <div
                    onClick={() => handleExpand(inspection.id, inspection.videoId)}
                    style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: '#272343', marginBottom: 6 }}>{videoTitle}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {isRunning && (
                          <span style={{ fontSize: 12, background: '#FFF9E6', color: '#856404', padding: '2px 8px', borderRadius: 20, fontWeight: 700, border: '1px solid #FFD803' }}>
                            検証中...
                          </span>
                        )}
                        {isError && (
                          <span style={{ fontSize: 12, background: '#f8d7da', color: '#721c24', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>
                            エラー
                          </span>
                        )}
                        {!isRunning && !isError && (
                          <>
                            <span style={{ fontSize: 12, background: '#d4edda', color: '#155724', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>OK {okCount}</span>
                            {ngCount > 0 && <span style={{ fontSize: 12, background: '#f8d7da', color: '#721c24', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>NG {ngCount}</span>}
                            {reviewCount > 0 && <span style={{ fontSize: 12, background: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: 20, fontWeight: 700 }}>要確認 {reviewCount}</span>}
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, color: '#BAE8E8' }}>
                          {new Date(inspection.createdAt).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                          {' '}
                          {new Date(inspection.createdAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {inspection.completedAt && (() => {
                          const sec = Math.round((new Date(inspection.completedAt).getTime() - new Date(inspection.createdAt).getTime()) / 1000)
                          const label = sec >= 60 ? `${Math.floor(sec / 60)}分${sec % 60}秒` : `${sec}秒`
                          return <div style={{ fontSize: 11, color: '#BAE8E8', opacity: 0.7 }}>実行時間: {label}</div>
                        })()}
                      </div>
                      <button
                        onClick={e => handleDelete(e, inspection.id, isRunning)}
                        title="この検品を削除"
                        style={{
                          background: 'none', border: '1px solid #eee', borderRadius: 6,
                          cursor: 'pointer', padding: '4px 7px', color: '#ccc', fontSize: 14,
                          lineHeight: 1, flexShrink: 0,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#f8d7da'; (e.currentTarget as HTMLButtonElement).style.color = '#dc3545' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#eee'; (e.currentTarget as HTMLButtonElement).style.color = '#ccc' }}
                      >
                        🗑
                      </button>
                      {!isRunning && <span style={{ color: '#BAE8E8', fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</span>}
                    </div>
                  </div>
                  {isExpanded && !isRunning && (
                    <div style={{ borderTop: '1px solid #E3F6F5', padding: '20px 20px 16px' }}>
                      {renderResults(inspection)}
                      {historyFrames.length > 0 && (
                        <OcrPanel frames={historyFrames} frameInterval={frameIntervalSeconds} />
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
