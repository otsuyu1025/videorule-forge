import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { NextRequest } from 'next/server'

// Next.js 16 では params が Promise になるため、await して NextAuth に渡す
const nextAuth = NextAuth(authOptions)

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const params = await context.params
  return nextAuth(request, { params })
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  const params = await context.params
  return nextAuth(request, { params })
}
