import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import Providers from '@/components/Providers'

export const metadata: Metadata = {
  title: 'VideoRule Forge — 動画広告検品プラットフォーム',
  description: 'AI動画検品。動画広告検品プラットフォーム。',
  verification: {
    google: 'Jph0dp7FCQ-R8AGCNWnkzaKRxIuBYvzQjTbPAYJCzxw',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, background: '#FFFFFE' }}>
        <Providers>
          {/* Sidebar はクライアントコンポーネント。モバイルヘッダーも内包 */}
          <Sidebar />
          {/* メインコンテンツ: app-main クラスでレスポンシブ margin を制御 */}
          <main className="app-main">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
