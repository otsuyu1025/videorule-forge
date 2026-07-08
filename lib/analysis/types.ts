export interface VideoMeta {
  duration: number         // 秒
  width: number
  height: number
  fps: number
  bitrate: number          // kbps
  videoCodec: string
  audioCodec?: string
  hasAudio: boolean
  fileSize: number         // bytes
}

export interface FrameData {
  timestamp: number        // 秒（動画先頭からの経過）
  imagePath?: string       // 保存先の絶対パス
  ocrText: string          // このフレームのOCR結果
}

export interface TranscriptChunk {
  start: number   // 秒
  end: number     // 秒
  text: string
}

export interface ExtractedFeatures {
  meta: VideoMeta
  frames: FrameData[]
  ocrTexts: string[]             // 全フレームのテキスト集約（重複除去・空行除去済み）
  transcription: string          // Whisper文字起こし結果（全文）
  transcriptChunks: TranscriptChunk[]  // タイムスタンプ付きセグメント
  extractedAt: string            // ISO8601
}

export interface AnalysisConfig {
  frameInterval: number    // 何秒ごとに1フレーム抽出するか
  maxFrames: number        // 最大フレーム数
}
