'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Guideline } from '@/types'

export default function GuidelineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [guideline, setGuideline] = useState<Guideline | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [existingCount, setExistingCount] = useState<number | null>(null)
  const [analyzeError, setAnalyzeError] = useState('')
  const [lastRunCount, setLastRunCount] = useState<number | null>(null)
  const [analyzeStartCount, setAnalyzeStartCount] = useState<number | null>(null)

  const fetchCandidates = async (): Promise<number> => {
    const data = await fetch(`/api/rule-candidates?guidelineId=${id}`).then(r => r.json())
    const count = Array.isArray(data) ? data.length : 0
    setExistingCount(count)
    return count
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/guidelines').then(r => r.json()),
      fetch(`/api/rule-candidates?guidelineId=${id}`).then(r => r.json()),
    ]).then(([list, candidates]: [Guideline[], unknown[]]) => {
      const found = list.find(g => g.id === id)
      setGuideline(found || null)
      setExistingCount(candidates.length)
      setLoading(false)
    })
  }, [id])

  // バックエンドが Railway タイムアウト後も処理を続けた場合のフォールバックポーリング
  // analyzing=true かつ HTTP が途切れた場合に、最大3分間候補の出現を監視する
  useEffect(() => {
    if (!analyzing || analyzeStartCount === null) return
    const startCount = analyzeStartCount  // narrow to number for closure
    const started = Date.now()
    const MAX_WAIT = 3 * 60 * 1000
    const interval = setInterval(async () => {
      if (Date.now() - started > MAX_WAIT) {
        setAnalyzeError('解析がタイムアウトしました。もう一度お試しください。')
        setAnalyzing(false)
        return
      }
      try {
        const count = await fetchCandidates()
        if (count > startCount) {
          setLastRunCount(count - startCount)
          setAnalyzeError('')
          setAnalyzing(false)
        }
      } catch { /* ignore */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [analyzing, id, analyzeStartCount])

  const handleDelete = async () => {
    if (!confirm('このガイドラインを削除しますか？\n一度削除すると元に戻せません。')) return
    await fetch(`/api/guidelines/${id}`, { method: 'DELETE' })
    router.push('/guidelines')
  }

  const handleAnalyze = async () => {
    const startCount = existingCount ?? 0
    setAnalyzeStartCount(startCount)
    setAnalyzing(true)
    setAnalyzeError('')
    let networkError = false
    try {
      const res = await fetch(`/api/guidelines/${id}/candidates`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setAnalyzeError(data.error || 'ルール候補の生成に失敗しました')
      } else {
        const newCount = Array.isArray(data) ? data.length : 0
        setLastRunCount(newCount)
        setExistingCount(prev => (prev ?? 0) + newCount)
      }
    } catch {
      // ネットワーク切断 — Railway プロキシが 30s でタイムアウトしてもバックエンドは処理中の可能性がある
      networkError = true
      setAnalyzeError('接続が切れました。バックエンドで処理が継続している可能性があります。しばらくお待ちください…')
    } finally {
      // 最新の候補件数を取得
      const currentCount = await fetchCandidates().catch(() => startCount)
      if (currentCount > startCount) {
        setLastRunCount(currentCount - startCount)
        setAnalyzeError('')
        setAnalyzing(false)
      } else if (!networkError) {
        // API エラーまたは正常完了 — ポーリング不要
        setAnalyzing(false)
      }
      // networkError かつ候補なし → analyzing=true のままポーリングに委ねる
    }
  }

  if (loading) return (
    <div style={{ padding: 48, color: '#2D334A', opacity: 0.6 }}>読み込み中...</div>
  )

  if (!guideline) return (
    <div style={{ padding: 48 }}>
      <Link href="/production-rules/sources" style={{ color: '#272343', fontSize: 13, textDecoration: 'none' }}>← 知識ソースへ戻る</Link>
      <div style={{ marginTop: 32, color: '#2D334A' }}>ガイドラインが見つかりません。</div>
    </div>
  )

  const lines = guideline.content.split('\n')
  const canAnalyze = !!guideline.content

  return (
    <div style={{ padding: 48, maxWidth: 760, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/production-rules/sources" style={{ color: '#2D334A', fontSize: 13, textDecoration: 'none', opacity: 0.6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          ← 知識ソースへ戻る
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
            Guideline
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#272343', margin: 0, lineHeight: 1.3 }}>
            {guideline.title}
          </h1>
          <div style={{ fontSize: 12, color: '#BAE8E8', marginTop: 12 }}>
            最終更新: {new Date(guideline.updatedAt).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 24, flexShrink: 0 }}>
          <Link
            href={`/guidelines/${id}/edit`}
            style={{
              background: '#FFD803', color: '#272343', border: 'none',
              borderRadius: 8, padding: '10px 20px', fontWeight: 700,
              fontSize: 14, cursor: 'pointer', textDecoration: 'none',
            }}
          >
            編集する
          </Link>
          <button
            onClick={handleDelete}
            style={{
              background: 'transparent', color: '#ff6b6b',
              border: '1px solid #ffd0d0', borderRadius: 8,
              padding: '10px 14px', fontSize: 13, cursor: 'pointer',
            }}
          >
            削除
          </button>
        </div>
      </div>

      {/* ガイドライン本文 */}
      <div style={{
        background: '#fff', border: '1px solid #E3F6F5',
        borderRadius: 16, padding: '36px 40px', lineHeight: 1.9,
      }}>
        {lines.map((line, i) => {
          if (line.trim() === '') return <div key={i} style={{ height: 12 }} />
          const isBullet = /^[・•\-]/.test(line.trim())
          const isHeading = /^#+\s/.test(line.trim()) || (line.trim().endsWith('：') || line.trim().endsWith(':'))

          if (isHeading && !isBullet) {
            return (
              <div key={i} style={{
                fontSize: 14, fontWeight: 700, color: '#272343',
                marginTop: i > 0 ? 24 : 0, marginBottom: 8,
                paddingBottom: 6, borderBottom: '1px solid #E3F6F5',
              }}>
                {line}
              </div>
            )
          }
          if (isBullet) {
            return (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span style={{ color: '#BAE8E8', flexShrink: 0, marginTop: 2 }}>▸</span>
                <span style={{ fontSize: 15, color: '#2D334A' }}>{line.replace(/^[・•\-]\s*/, '')}</span>
              </div>
            )
          }
          return (
            <p key={i} style={{ fontSize: 15, color: '#2D334A', margin: 0, marginBottom: 4 }}>
              {line}
            </p>
          )
        })}
      </div>

      {/* ルール候補を生成セクション */}
      <div style={{
        marginTop: 32, background: '#fff',
        border: '1px solid #E3F6F5', borderRadius: 14, padding: '28px 32px',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#272343', marginBottom: 8 }}>
          このガイドラインからルール候補を生成
        </div>
        <p style={{ fontSize: 14, color: '#2D334A', lineHeight: 1.7, marginTop: 0, marginBottom: 20 }}>
          AIがガイドライン文書を解析し、動画制作ルールの候補を自動抽出します。<br />
          生成された候補は「ルール候補」画面で確認・承認できます。
        </p>

        {!canAnalyze && (
          <div style={{ fontSize: 13, color: '#e67e22', background: '#FFF8DC', border: '1px solid #FFD803', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            ⚠️ このファイルからテキストを抽出できませんでした。<br />
            対応形式：.txt / .pdf / .docx。スキャンされたPDFや画像PDFはテキスト抽出できません。<br />
            テキストとして保存し直すか、.txt形式でアップロードし直してください。
          </div>
        )}

        {/* 解析済バッジ */}
        {!analyzing && existingCount !== null && existingCount > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, padding: '12px 16px', background: '#F0FFF4', border: '1px solid #BAE8E8', borderRadius: 8 }}>
            <span style={{ fontSize: 13, color: '#27ae60', fontWeight: 700 }}>
              ✓ 解析済：{existingCount}件のルール候補が生成されています
            </span>
            <Link href="/production-rules/candidates" style={{ fontSize: 13, color: '#272343', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              ルール候補を確認 →
            </Link>
          </div>
        )}

        {/* 直前の実行結果が0件 */}
        {lastRunCount === 0 && !analyzing && (
          <div style={{ fontSize: 13, color: '#e67e22', background: '#FFF8DC', border: '1px solid #FFD803', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            ⚠️ 解析は完了しましたが、ルール候補が0件でした。<br />
            考えられる原因：<br />
            ・ ANTHROPIC_API_KEY が Railway に設定されていない<br />
            ・ APIキーが無効または残高不足<br />
            Railway の Variables タブで <code style={{ background: 'rgba(0,0,0,0.08)', padding: '1px 4px', borderRadius: 3 }}>ANTHROPIC_API_KEY</code> を確認してください。
          </div>
        )}

        {analyzeError && (
          <div style={{ fontSize: 13, color: '#c0392b', background: '#fff0f0', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
            {analyzeError}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={analyzing || !canAnalyze}
          style={{
            background: analyzing || !canAnalyze ? '#ccc' : '#272343',
            color: '#FFD803', border: 'none', borderRadius: 8,
            padding: '12px 28px', fontWeight: 700, fontSize: 14,
            cursor: analyzing || !canAnalyze ? 'default' : 'pointer',
          }}
        >
          {analyzing
            ? '⏳ 解析中...'
            : existingCount !== null && existingCount > 0
              ? '✨ 再解析する'
              : '✨ ルール候補を生成する'}
        </button>
        {existingCount !== null && existingCount > 0 && !analyzing && (
          <p style={{ fontSize: 12, color: '#999', marginTop: 8, marginBottom: 0 }}>
            ※ 再解析すると追加でルール候補が生成されます
          </p>
        )}
      </div>
    </div>
  )
}
