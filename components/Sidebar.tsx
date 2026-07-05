'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const navItems = [
  { href: '/', label: 'ダッシュボード', icon: '🏠' },
  { href: '/production-rules', label: '動画制作ルール', icon: '📋', isSection: true },
  { href: '/inspections', label: '動画検品', icon: '🔍' },
  { href: '/settings', label: '設定', icon: '⚙️' },
]

const subItems = [
  { href: '/production-rules/sources', label: '知識ソース', icon: '🗂️' },
  { href: '/production-rules/candidates', label: 'ルール候補', icon: '💡' },
  { href: '/production-rules/rules', label: 'ルール管理', icon: '✅' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // 画面幅の監視
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ルート変更でモバイルメニューを閉じる
  useEffect(() => {
    if (isMobile) setIsOpen(false)
  }, [pathname, isMobile])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const isProductionRulesSection = pathname.startsWith('/production-rules')

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

  const sidebarNav = (
    <nav
      className={`app-sidebar${isOpen ? ' sidebar-open' : ''}`}
      style={{
        width: 240,
        background: '#272343',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* ブランドロゴ (デスクトップのみ表示 / モバイルはヘッダーに表示) */}
      {!isMobile && (
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
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
      )}

      {/* ナビゲーション */}
      <div style={{ padding: '16px 8px', flex: 1, overflowY: 'auto' }}>
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
              {subItems.map(item => (
                <Link key={item.href} href={item.href} style={subLinkStyle(item.href)}>
                  <span style={{ fontSize: 13 }}>{item.icon}</span>
                  {item.label}
                </Link>
              ))}
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

  return (
    <>
      {/* ── モバイルヘッダー ─────────────────────────────── */}
      <header className="mobile-header">
        {/* ブランド名 */}
        <div>
          <div style={{ color: '#FFD803', fontSize: 15, fontWeight: 700, lineHeight: 1.1 }}>
            VideoRule Forge
          </div>
          <div style={{ color: 'rgba(255,216,3,0.75)', fontSize: 10 }}>AI動画検品</div>
        </div>

        {/* ハンバーガーボタン */}
        <button
          onClick={() => setIsOpen(prev => !prev)}
          aria-label={isOpen ? 'メニューを閉じる' : 'メニューを開く'}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* ハンバーガーアイコン (3本線 → × に変化) */}
          {isOpen ? (
            /* × アイコン */
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <line x1="4" y1="4" x2="18" y2="18" stroke="#FFD803" strokeWidth="2.2" strokeLinecap="round"/>
              <line x1="18" y1="4" x2="4" y2="18" stroke="#FFD803" strokeWidth="2.2" strokeLinecap="round"/>
            </svg>
          ) : (
            /* ☰ アイコン */
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <line x1="3" y1="6" x2="19" y2="6" stroke="#FFD803" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="11" x2="19" y2="11" stroke="#FFD803" strokeWidth="2" strokeLinecap="round"/>
              <line x1="3" y1="16" x2="19" y2="16" stroke="#FFD803" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
        </button>
      </header>

      {/* ── オーバーレイ (モバイルでメニューが開いたとき) ── */}
      <div
        className={`sidebar-overlay${isOpen ? ' overlay-open' : ''}`}
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
      />

      {/* ── サイドバー本体 ─────────────────────────────── */}
      {sidebarNav}
    </>
  )
}
