import Link from 'next/link'

const features = [
  {
    icon: '🎬',
    title: '動画をアップロードするだけ',
    desc: 'AIがフレームを抽出してテキストを解析。問題のある表現をカテゴリ別に整理して表示します。',
  },
  {
    icon: '⚖️',
    title: '薬機法チェック標準搭載',
    desc: '設定不要で即日利用可能。美容・健康・化粧品広告に多い誇大表現・効果保証の表現を自動検出します。',
  },
  {
    icon: '📄',
    title: '企業ガイドラインも対応',
    desc: 'PDFや社内文書をアップロードするとAIが検品ルールを自動生成。ブランド固有のルールを柔軟に適用できます。',
  },
]

const targets = [
  { icon: '🛒', label: '美容・健康系 EC事業者', desc: '薬機法リスクを抱える動画広告の事前チェックに' },
  { icon: '🏢', label: '広告代理店', desc: '動画制作・入稿前の審査フローに組み込める' },
  { icon: '🏭', label: 'メーカー・ブランド担当', desc: 'ガイドライン遵守の確認を制作フローに自動化' },
]

export default function LandingPage() {
  return (
    <div style={{ background: '#272343', minHeight: '100vh', color: '#FFFFFE' }}>

      {/* ── ヘッダー ── */}
      <header style={{
        padding: '20px 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div>
          <div style={{ color: '#FFD803', fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>
            VideoRule Forge
          </div>
          <div style={{ color: 'rgba(255,216,3,0.65)', fontSize: 11, marginTop: 2 }}>
            AI動画検品
          </div>
        </div>
        <Link href="/login" style={{
          background: '#FFD803',
          color: '#272343',
          fontWeight: 700,
          fontSize: 13,
          padding: '10px 20px',
          borderRadius: 8,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}>
          ログイン
        </Link>
      </header>

      {/* ── ヒーロー ── */}
      <section style={{
        maxWidth: 760,
        margin: '0 auto',
        padding: '80px 32px 72px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          background: 'rgba(255,216,3,0.12)',
          border: '1px solid rgba(255,216,3,0.3)',
          color: '#FFD803',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.1em',
          padding: '5px 14px',
          borderRadius: 20,
          marginBottom: 28,
          textTransform: 'uppercase',
        }}>
          動画広告検品プラットフォーム
        </div>

        <h1 style={{
          fontSize: 'clamp(24px, 4vw, 36px)',
          fontWeight: 700,
          lineHeight: 1.5,
          color: '#FFFFFE',
          margin: '0 0 20px',
          letterSpacing: '-0.01em',
        }}>
          動画広告の薬機法・ガイドライン適合を、<br />
          AIが自動で確認する。
        </h1>

        <p style={{
          fontSize: 15,
          color: 'rgba(255,255,254,0.65)',
          lineHeight: 1.8,
          margin: '0 0 40px',
          maxWidth: 560,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          美容・健康・化粧品業界の動画広告を対象に、薬機法および企業ガイドラインへの適合をAIが自動判定。
          動画をアップロードするだけで、修正すべき表現を即座に特定します。
        </p>

        <Link href="/login" style={{
          display: 'inline-block',
          background: '#FFD803',
          color: '#272343',
          fontWeight: 700,
          fontSize: 15,
          padding: '16px 40px',
          borderRadius: 10,
          textDecoration: 'none',
        }}>
          Googleアカウントでログイン →
        </Link>
      </section>

      {/* ── 機能紹介 ── */}
      <section style={{
        background: 'rgba(255,255,255,0.04)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '60px 32px',
      }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{
            textAlign: 'center',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#FFD803',
            textTransform: 'uppercase',
            marginBottom: 36,
            opacity: 0.85,
          }}>
            主な機能
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}>
            {features.map(f => (
              <div key={f.title} style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: '24px 20px',
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#FFFFFE',
                  marginBottom: 8,
                  lineHeight: 1.4,
                }}>
                  {f.title}
                </div>
                <div style={{
                  fontSize: 13,
                  color: 'rgba(255,255,254,0.6)',
                  lineHeight: 1.7,
                }}>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 対象ユーザー ── */}
      <section style={{ padding: '60px 32px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: '#FFD803',
          textTransform: 'uppercase',
          marginBottom: 36,
          opacity: 0.85,
        }}>
          こんな方に
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {targets.map(t => (
            <div key={t.label} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '16px 20px',
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>{t.icon}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFE', marginBottom: 2 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.55)' }}>
                  {t.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── フッターCTA ── */}
      <section style={{
        textAlign: 'center',
        padding: '48px 32px 64px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}>
        <p style={{ color: 'rgba(255,255,254,0.5)', fontSize: 13, marginBottom: 20 }}>
          Googleアカウントでログインしてご利用ください
        </p>
        <Link href="/login" style={{
          display: 'inline-block',
          background: 'transparent',
          color: '#FFD803',
          fontWeight: 700,
          fontSize: 14,
          padding: '12px 32px',
          borderRadius: 8,
          textDecoration: 'none',
          border: '1.5px solid #FFD803',
        }}>
          ログイン
        </Link>
      </section>
    </div>
  )
}
