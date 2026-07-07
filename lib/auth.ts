import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

// ALLOWED_DOMAINS が設定されている場合のみドメイン制限を適用
// 例: ALLOWED_DOMAINS=company-a.co.jp,company-b.co.jp
// 未設定 or 空文字 = すべての Google アカウントを許可
const allowedDomains: string[] = (process.env.ALLOWED_DOMAINS ?? '')
  .split(',')
  .map(d => d.trim())
  .filter(Boolean)

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],

  pages: {
    signIn: '/login',
    error: '/login',
  },

  callbacks: {
    async signIn({ user }) {
      // ドメイン制限なし（全アカウント許可）
      if (allowedDomains.length === 0) return true

      const email = user.email ?? ''
      const domain = email.split('@')[1] ?? ''
      const allowed = allowedDomains.includes(domain)

      if (!allowed) {
        console.warn(`[auth] ログイン拒否: ${email} (許可ドメイン外)`)
      }
      return allowed
    },

    async session({ session, token }) {
      return session
    },
  },

  session: {
    strategy: 'jwt',
  },
}
