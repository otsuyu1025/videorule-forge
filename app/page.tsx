import Link from 'next/link'

export default function TopPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 120px)',
      padding: '0 24px',
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

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
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
    </div>
  )
}
