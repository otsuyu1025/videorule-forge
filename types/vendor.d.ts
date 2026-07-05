// Type declarations for packages without built-in TypeScript support
declare module '@xenova/transformers' {
  export function pipeline(
    task: string,
    model: string,
    options?: Record<string, unknown>
  ): Promise<(input: string | Float32Array, options?: Record<string, unknown>) => Promise<{ text: string }>>

  export const env: {
    allowRemoteModels: boolean
    allowLocalModels: boolean
    useBrowserCache: boolean
    backends: {
      onnx: {
        wasm: { numThreads: number }
      }
    }
  }
}
