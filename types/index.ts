export type VideoType = 'sample' | 'inspection'

export type VideoStatus =
  | 'pending'
  | 'downloading'           // yt-dlp: SNS動画ダウンロード中
  | 'extracting_meta'       // ffprobe: 動画情報取得中
  | 'extracting_frames'     // ffmpeg: フレーム抽出中
  | 'running_ocr'           // Tesseract: テキスト読み取り中
  | 'transcribing'          // Whisper: 音声文字起こし中
  | 'awaiting_review'       // Stage 1完了・ユーザー確認待ち（お手本動画のみ）
  | 'generating_candidates' // Claude: ルール候補生成中（お手本動画のみ）
  | 'analyzed'
  | 'error'
  // 後方互換（旧DB データ用）
  | 'analyzing'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type InspectionStatus = 'pending' | 'running' | 'completed' | 'error'

export type JudgmentResult = 'OK' | 'NG' | '要確認'

export type SourceType = 'sampleVideo' | 'guideline'

export interface Source {
  type: SourceType
  id: string
  name: string
}

export interface Video {
  id: string
  title: string
  type: VideoType
  url?: string
  filePath?: string
  status: VideoStatus
  errorMessage?: string
  originalWidth?: number   // 圧縮前の元解像度・フレームレート
  originalHeight?: number
  originalFps?: number
  createdAt: string
  deletedAt?: string
  analysisProgress?: { stage: 'ocr' | 'vision_ocr'; current: number; total: number }
}

// Stage 1 特徴抽出の結果型（lib/analysis/types.ts と対応）
export interface VideoMeta {
  duration: number
  width: number
  height: number
  fps: number
  bitrate: number
  videoCodec: string
  audioCodec?: string
  hasAudio: boolean
  fileSize: number
}

export interface FrameData {
  timestamp: number
  imagePath?: string
  ocrText: string
}

export interface TranscriptChunk {
  start: number   // 秒（動画先頭からの経過時間）
  end: number
  text: string
}

export interface VideoFeature {
  id: string
  videoId: string
  // Stage 1: AI不使用の特徴抽出（実測値）
  meta?: VideoMeta
  frames?: FrameData[]
  ocrTexts?: string[]           // 全フレームのOCRテキスト（重複除去済み）
  transcription?: string        // Whisper文字起こし（全文）
  transcriptChunks?: TranscriptChunk[]  // タイムスタンプ付きセグメント
  extractedAt?: string          // Stage 1 完了日時
  // 将来拡張スロット
  brandColors?: string[]     // ロゴ・ブランドカラー抽出（Phase 2）
  sceneCount?: number        // シーン数（Phase 2）
  // 後方互換フィールド（既存DBデータ向け）
  textContent?: string
  audioContent?: string
  colors?: string[]
  layout?: string
  duration?: number
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface ProductionRule {
  id: string
  content: string
  category: string
  reason: string
  isActive: boolean
  history: Array<{ editedAt: string; content: string; reason: string }>
  source?: Source
  createdAt: string
  updatedAt: string
  deletedAt?: string
}

export interface RuleCandidate {
  id: string
  videoId?: string
  guidelineId?: string
  source?: Source
  content: string
  category: string
  reason: string
  approvalStatus: ApprovalStatus
  createdAt: string
  reviewedAt?: string
  deletedAt?: string
}

export interface InspectionResult {
  ruleId: string
  ruleContent: string
  category?: string
  judgment: JudgmentResult
  reason: string
  /** サマリー表示用の簡潔な修正指示（例: 「フォントサイズを12px以上に修正してください」）。ない場合は reason を使用 */
  actionItem?: string | null
  confidence: number
  humanOverride?: JudgmentResult
  humanOverrideReason?: string
}

export interface VideoInspection {
  id: string
  videoId: string
  status: InspectionStatus
  results: InspectionResult[]
  yakujiReference?: { sourceName: string; sourceUpdatedAt?: string }
  createdAt: string
  completedAt?: string
}

export interface YakujiRule {
  id: string
  label: string
  description: string
  source_article?: string  // 引用元（例: 第十章第六十六条）、不明な場合は「不明」
  examples_ng: string[]
  examples_ok?: string[]
  enabled?: boolean  // 省略時はtrue扱い
}

export interface YakujiSettings {
  enabled: boolean
  source_name?: string
  source_url?: string
  source_updated_at?: string
  imported_at?: string
  rules: YakujiRule[]
}

export interface InspectionReport {
  id: string
  inspectionId: string
  videoId: string
  issues: Array<{ ruleContent: string; judgment: JudgmentResult; reason: string }>
  suggestions: string[]
  comments: string
  createdAt: string
}

export interface Guideline {
  id: string
  title: string
  content: string
  fileName?: string
  fileType?: string
  updatedAt: string
  deletedAt?: string
}

export type SnsBrowser = 'chrome' | 'firefox' | 'safari' | 'edge' | 'brave' | 'chromium'

export interface AppSettings {
  snsBrowser?: SnsBrowser
  frameRetentionDays?: number  // フレーム画像の保持日数（デフォルト30日）
  yakuji?: YakujiSettings
}

export interface DbSchema {
  videos: Video[]
  videoFeatures: VideoFeature[]
  productionRules: ProductionRule[]
  ruleCandidates: RuleCandidate[]
  videoInspections: VideoInspection[]
  inspectionReports: InspectionReport[]
  guidelines: Guideline[]
  settings: AppSettings
}
