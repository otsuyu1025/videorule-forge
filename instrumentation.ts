/**
 * Next.js Instrumentation
 * サーバー起動時に一度だけ実行される（ホットリロードでは再実行されない）
 */
export async function register() {
  // Edge ランタイムでは fs が使えないため Node.js のみで実行
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initLogger } = await import('./lib/logger')
    await initLogger()
  }
}
