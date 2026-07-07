import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token) {
    // 未ログイン → /login へリダイレクト（元のURLをクエリに保持）
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // 認証不要なパスを除外:
    //   /api/auth/*  — NextAuth 自身の認証エンドポイント
    //   /api/health  — UptimeRobot 死活監視
    //   /_next/*     — Next.js 静的ファイル
    //   /favicon.ico
    //   /login       — ログインページ
    '/((?!api/auth|api/health|_next/static|_next/image|favicon\\.ico|login).*)',
  ],
}
