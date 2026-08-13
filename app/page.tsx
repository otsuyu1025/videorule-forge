import Link from 'next/link'

const guideItems = [
  {
    icon: '🎬',
    scenario: '手元の動画を検品したい',
    label: '動画検品',
    href: '/inspections',
  },
  {
    icon: '📋',
    scenario: '今登録されているルールを確認したい',
    label: '検品ルール一覧',
    href: '/production-rules',
  },
  {
    icon: '🗂️',
    scenario: 'ガイドラインやルールを登録したい',
    label: 'ガイドライン登録',
    href: '/production-rules/sources',
  },
  {
    icon: '⚖️',
    scenario: '薬機法のルールを確認したい',
    label: '薬機法',
    href: '/production-rules/yakuji',
  },
]

export default function TopPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 120px)',
      padding: '40px 24px 60px',
      textAlign: 'center',
    }}>
      <h1 style={{
        fontSize: 28,
        fontWeight: 700,
        color: '#272343',
        margin: '0 0 40px',
        letterSpacing: '-0.01em',
      }}>
        何をしますか？
      </h1>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 56 }}>
        <Link href="/inspections" style={{ textDecoration: 'none' }}>
          <div style={{
            background: '#272343',
            color: '#FFD803',
            fontWeight: 700,
            fontSize: 15,
            padding: '16px 32px',
            borderRadius: 10,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>
            動画を検品する
          </div>
        </Link>

        <Link href="/production-rules/sources" style={{ textDecoration: 'none' }}>
          <div style={{
            background: '#fff',
            color: '#272343',
            fontWeight: 700,
            fontSize: 15,
            padding: '16px 32px',
            borderRadius: 10,
            border: '2px solid #E3F6F5',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>
            検品ルールを登録する
          </div>
        </Link>
      </div>

      {/* 使い方ヒント */}
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: '#BAE8E8',
          marginBottom: 12,
          textTransform: 'uppercase',
        }}>
          使い方ヒント
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {guideItems.map(item => (
            <Link key={item.href} href={item.href} className="guide-card">
              <div style={{ fontSize: 20, flexShrink: 0, width: 32, textAlign: 'center' }}>{item.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>{item.scenario}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#272343' }}>{item.label}</div>
              </div>
              <div style={{ fontSize: 16, color: '#9ca3af', flexShrink: 0 }}>›</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
