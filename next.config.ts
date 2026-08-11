import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // サーバーサイドでネイティブモジュール・WASMを使うパッケージをバンドル対象外にする
  // @xenova/transformers（ONNX Runtime）, tesseract.js（WASM）が対象
  serverExternalPackages: [
    '@xenova/transformers',
    'onnxruntime-node',
    'tesseract.js',
    'sharp',
  ],
  experimental: {
    // proxy.ts（認証ミドルウェア）がリクエストボディをバッファリングする際の上限
    // デフォルト 10MB では動画アップロードが失敗するため MAX_VIDEO_SIZE_MB に合わせて拡張
    proxyClientMaxBodySize: '200mb',
  },
}

export default nextConfig
