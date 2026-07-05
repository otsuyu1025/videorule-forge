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
}

export default nextConfig
