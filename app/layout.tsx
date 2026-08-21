import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import Providers from '@/components/Providers'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'VideoRule Forge — 動画広告検品プラットフォーム',
  description: 'AI動画検品。動画広告検品プラットフォーム。',
  verification: {
    google: 'Jph0dp7FCQ-R8AGCNWnkzaKRxIuBYvzQjTbPAYJCzxw',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="ja">
      <body style={{ margin: 0, background: '#FFFFFE' }}>
        <Providers>
          {/* ログイン済みのときだけサイドバーを表示 */}
          {session && <Sidebar />}
          <main className={session ? 'app-main' : 'app-main-full'}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
}
