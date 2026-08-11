import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

// ALLOWED_EMAILS: 許可するメールアドレスをカンマ区切りで指定
// 例: ALLOWED_EMAILS=alice@gmail.com,bob@company.co.jp
// 未設定 or 空文字 = ALLOWED_DOMAINS による判定へ
const allowedEmails: string[] = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean)

// ALLOWED_DOMAINS: 許可するドメインをカンマ区切りで指定（メール制限がない場合に使用）
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
      const email = (user.email ?? '').toLowerCase()

      // メールアドレス制限が設定されている場合はそちらを優先
      if (allowedEmails.length > 0) {
        const allowed = allowedEmails.includes(email)
        if (!allowed) console.warn(`[auth] ログイン拒否: ${email} (許可メール外)`)
        return allowed
      }

      // ドメイン制限
      if (allowedDomains.length > 0) {
        const domain = email.split('@')[1] ?? ''
        const allowed = allowedDomains.includes(domain)
        if (!allowed) console.warn(`[auth] ログイン拒否: ${email} (許可ドメイン外)`)
        return allowed
      }

      // どちらも未設定 = 全アカウント許可
      return true
    },

    async session({ session, token }) {
      return session
    },
  },

  session: {
    strategy: 'jwt',
  },
}
