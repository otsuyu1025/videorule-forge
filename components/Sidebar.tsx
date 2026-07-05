'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const linkStyle = (href: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '9px 12px',
    borderRadius: 7,
    textDecoration: 'none',
    color: isActive(href) ? '#272343' : 'rgba(255,255,255,0.72)',
    background: isActive(href) ? '#FFD803' : 'transparent',
    fontWeight: isActive(href) ? 600 : 400,
    fontSize: 14,
    marginBottom: 2,
    transition: 'all 0.1s',
  })

  const subLinkStyle = (href: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px 8px 20px',
    borderRadius: 7,
    textDecoration: 'none',
    color: isActive(href) ? '#272343' : 'rgba(255,255,255,0.65)',
    background: isActive(href) ? '#FFD803' : 'transparent',
    fontWeight: isActive(href) ? 600 : 400,
    fontSize: 13,
    marginBottom: 1,
    transition: 'all 0.1s',
  })

  const isProductionRulesSection =
    pathname.startsWith('/production-rules')

  return (
    <nav style={{
      width: 240,
      minHeight: '100vh',
      background: '#272343',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <div style={{ color: '#FFD803', fontSize: 20, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>
          VideoRule Forge
        </div>
        <div style={{ color: '#FFD803', fontSize: 13, fontWeight: 400, marginBottom: 4, opacity: 0.9 }}>
          AI動画検品
        </div>
        <div style={{ color: '#FFFFFE', fontSize: 11, fontWeight: 400, lineHeight: 1.5, opacity: 0.65 }}>
          動画制作ルールを育てる<br />プラットフォーム
        </div>
      </div>

      <div style={{ padding: '16px 8px', flex: 1 }}>
        <Link href="/" style={linkStyle('/')}>
          <span style={{ fontSize: 15 }}>🏠</span>
          ダッシュボード
        </Link>

        <div style={{ marginTop: 8, marginBottom: 4 }}>
          <Link
            href="/production-rules"
            style={{
              ...linkStyle('/production-rules'),
              background: isProductionRulesSection ? 'rgba(255,216,3,0.12)' : 'transparent',
              color: isProductionRulesSection ? '#FFD803' : 'rgba(255,255,255,0.72)',
              fontWeight: isProductionRulesSection ? 700 : 400,
            }}
          >
            <span style={{ fontSize: 15 }}>📋</span>
            動画制作ルール
          </Link>

          {isProductionRulesSection && (
            <div style={{
              marginLeft: 8,
              borderLeft: '1px solid rgba(255,216,3,0.3)',
              paddingLeft: 4,
              marginTop: 2,
              marginBottom: 2,
            }}>
              <Link href="/production-rules/sources" style={subLinkStyle('/production-rules/sources')}>
                <span style={{ fontSize: 13 }}>🗂️</span>
                知識ソース
              </Link>
              <Link href="/production-rules/candidates" style={subLinkStyle('/production-rules/candidates')}>
                <span style={{ fontSize: 13 }}>💡</span>
                ルール候補
              </Link>
              <Link href="/production-rules/rules" style={subLinkStyle('/production-rules/rules')}>
                <span style={{ fontSize: 13 }}>✅</span>
                ルール管理
              </Link>
            </div>
          )}
        </div>

        <Link href="/inspections" style={linkStyle('/inspections')}>
          <span style={{ fontSize: 15 }}>🔍</span>
          動画検品
        </Link>

        <Link href="/settings" style={{ ...linkStyle('/settings'), marginTop: 8 }}>
          <span style={{ fontSize: 15 }}>⚙️</span>
          設定
        </Link>
      </div>

      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        color: 'rgba(255,255,255,0.3)',
        fontSize: 11,
      }}>
        VideoRule Forge v1.0
      </div>
    </nav>
  )
}
