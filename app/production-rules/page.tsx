'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HubData {
  totalSources: number
  pendingCandidates: number
  totalRules: number
}

function FlowStep({
  number, icon, title, description, count, countLabel, href, highlight,
}: {
  number: string; icon: string; title: string; description: string
  count: number; countLabel: string; href: string; highlight?: boolean
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: highlight ? '#272343' : '#fff',
        border: `2px solid ${highlight ? '#272343' : '#E3F6F5'}`,
        borderRadius: 16,
        padding: '28px 28px 24px',
        cursor: 'pointer',
        transition: 'transform 0.1s, box-shadow 0.1s',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: 16, right: 20,
          fontSize: 48, opacity: 0.07, lineHeight: 1,
          color: highlight ? '#FFD803' : '#272343',
          fontWeight: 900,
        }}>
          {number}
        </div>
        <div style={{ fontSize: 28, marginBottom: 12 }}>{icon}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: highlight ? '#FFD803' : '#272343', marginBottom: 6 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: highlight ? 'rgba(255,255,255,0.7)' : '#2D334A', lineHeight: 1.6, marginBottom: 20 }}>
          {description}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: highlight ? '#FFD803' : '#272343' }}>
            {count}
          </span>
          <span style={{ fontSize: 12, color: highlight ? 'rgba(255,216,3,0.7)' : '#999' }}>
            {countLabel}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function ProductionRulesHubPage() {
  const [data, setData] = useState<HubData>({ totalSources: 0, pendingCandidates: 0, totalRules: 0 })

  useEffect(() => {
    Promise.all([
      fetch('/api/videos?type=sample').then(r => r.json()),
      fetch('/api/guidelines').then(r => r.json()),
      fetch('/api/rule-candidates?status=pending').then(r => r.json()),
      fetch('/api/production-rules').then(r => r.json()),
    ]).then(([videos, guidelines, candidates, rules]) => {
      setData({
        totalSources: (videos?.length ?? 0) + (guidelines?.length ?? 0),
        pendingCandidates: candidates?.length ?? 0,
        totalRules: rules?.length ?? 0,
      })
    })
  }, [])

  return (
    <div style={{ padding: 48, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 48 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#BAE8E8', letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase' }}>
          Knowledge Engine
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 700, color: '#272343', margin: 0, lineHeight: 1.2 }}>
          動画制作ルール
        </h1>
        <p style={{ color: '#2D334A', marginTop: 12, fontSize: 15, lineHeight: 1.8, opacity: 0.8 }}>
          企業の知識をAIが整理し、動画制作ルールとして育てます。<br />
          知識ソースを登録 → ルール候補をレビュー → 動画制作ルールとして採用。
        </p>
      </div>

      <div className="flow-steps-grid">
        <FlowStep
          number="01"
          icon="🗂️"
          title="知識ソース"
          description="ガイドラインなどを登録します。AIが内容を解析し、ルールの材料を抽出します。"
          count={data.totalSources}
          countLabel="件登録済み"
          href="/production-rules/sources"
        />
        <div className="flow-arrow-h">→</div>
        <div className="flow-arrow-v">↓</div>
        <FlowStep
          number="02"
          icon="💡"
          title="ルール候補"
          description="AIが提案したルール候補です。承認・編集・却下を行います。承認されたものだけがルールになります。"
          count={data.pendingCandidates}
          countLabel="件 承認待ち"
          href="/production-rules/candidates"
          highlight={data.pendingCandidates > 0}
        />
        <div className="flow-arrow-h">→</div>
        <div className="flow-arrow-v">↓</div>
        <FlowStep
          number="03"
          icon="✅"
          title="ルール管理"
          description="正式に採用された動画制作ルールを管理します。検索・編集・更新履歴の確認ができます。"
          count={data.totalRules}
          countLabel="件のルール"
          href="/production-rules/rules"
        />
      </div>

      {data.pendingCandidates > 0 && (
        <Link href="/production-rules/candidates" style={{ textDecoration: 'none' }}>
          <div style={{
            background: '#FFD803',
            borderRadius: 12,
            padding: '18px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontWeight: 700, color: '#272343', fontSize: 16 }}>
                ⚠️ 承認待ちのルール候補が {data.pendingCandidates} 件あります
              </div>
              <div style={{ fontSize: 13, color: '#2D334A', marginTop: 4 }}>
                確認・承認してルール候補を動画制作ルールに追加しましょう。
              </div>
            </div>
            <div style={{ color: '#272343', fontSize: 20 }}>→</div>
          </div>
        </Link>
      )}

      {data.totalSources === 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #E3F6F5, #F5FCFC)',
          borderRadius: 16,
          padding: '40px 36px',
          textAlign: 'center',
          marginTop: 24,
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🌱</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#272343', marginBottom: 10 }}>
            まだ知識ソースが登録されていません
          </div>
          <div style={{ fontSize: 14, color: '#2D334A', lineHeight: 1.8, marginBottom: 24, opacity: 0.8 }}>
            ガイドラインなどを登録して、<br />
            動画制作ルールを育て始めましょう。
          </div>
          <Link href="/production-rules/sources/new" style={{
            background: '#272343', color: '#FFD803',
            padding: '12px 28px', borderRadius: 8, textDecoration: 'none',
            fontWeight: 700, fontSize: 14, display: 'inline-block',
          }}>
            最初の知識ソースを登録する
          </Link>
        </div>
      )}
    </div>
  )
}
