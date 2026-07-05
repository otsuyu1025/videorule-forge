# VideoRule Forge 運用ドキュメント

> 動画制作ルールを育てる品質保証プラットフォーム  
> 最終更新: 2026-07

---

## 目次

1. [システム概要](#1-システム概要)
2. [前提条件](#2-前提条件)
3. [起動・停止](#3-起動停止)
4. [画面ガイド](#4-画面ガイド)
5. [2つのワークフロー](#5-2つのワークフロー)
6. [設定一覧](#6-設定一覧)
7. [アーキテクチャ](#7-アーキテクチャ)
8. [ログ確認](#8-ログ確認)
9. [トラブルシューティング](#9-トラブルシューティング)
10. [既知の制限・注意事項](#10-既知の制限注意事項)
11. [ディレクトリ構成](#11-ディレクトリ構成)

---

## 1. システム概要

VideoRule Forge は、企業独自の動画制作ルールを育て、そのルールで動画を検品するプラットフォームです。

### 設計思想

```
知識ソース（お手本動画・ガイドライン）
    ↓  AI解析
ルール候補（AIが提案 → 人が承認）
    ↓  承認
動画制作ルール（企業の知識資産）
    ↓  活用
動画検品（ルールで動画をチェック）
```

- **AIは補助ツール**：最終判断は人が行う
- **特徴抽出はAI不使用**：ffprobe / ffmpeg / Tesseract / Whisper で実測値を取得
- **AIは意味理解のみ**：Claude はルール候補生成・検品判断に特化

---

## 2. 前提条件

### システム要件

| ツール | バージョン | 用途 | インストール確認 |
|--------|-----------|------|-----------------|
| Node.js | v20以上 | サーバー実行 | `node --version` |
| ffmpeg | 任意 | 動画解析・フレーム抽出 | `ffmpeg -version` |
| ffprobe | 任意 | 動画メタデータ取得 | `ffprobe -version` |
| yt-dlp | 任意 | SNS動画ダウンロード | `yt-dlp --version` |

### API キー

| サービス | 必須 | 用途 |
|---------|------|------|
| Anthropic（Claude） | ルール候補生成・動画検品に必要 | `ANTHROPIC_API_KEY` |

> APIキーがない場合でも、起動・データ管理・ファイルアップロードは動作します。

---

## 3. 起動・停止

### プロジェクトディレクトリ

```
/Users/otsuyu/Desktop/video-qa-platform/
```

### 停止

VS Code のターミナルで：

```
Ctrl + C
```

`^C` が表示されてプロンプトが戻れば完了。

### 起動（ログファイルあり・推奨）

```bash
cd /Users/otsuyu/Desktop/video-qa-platform
npm run dev:log
```

起動後：http://localhost:3000 でアクセス可能  
ログファイル：`data/dev.log`（追記形式）

### 起動（ターミナル表示のみ）

```bash
cd /Users/otsuyu/Desktop/video-qa-platform
npm run dev
```

### 初回起動時の注意

- Whisper モデル（約244MB）が初回解析時に自動ダウンロードされます
- ダウンロード中はターミナルに `[Whisper] モデルをロード中...` と表示されます
- 完了後はキャッシュされるため、2回目以降は高速です

---

## 4. 画面ガイド

### ナビゲーション構成

```
ダッシュボード
動画制作ルール
├── 知識ソース       ← お手本動画・ガイドラインの管理
├── ルール候補       ← AIが提案したルールのレビュー
└── ルール管理       ← 採用済みルールの管理
動画検品            ← 動画に対してルールを適用
設定
```

### ダッシュボード

- 承認待ちルール候補の件数アラート
- 動画制作ルール数・知識ソース数・検品完了数の統計
- 最近のルール・検品レポートの一覧

### 知識ソース

お手本動画とガイドラインを一元管理します。

**お手本動画の登録方法**
1. 「知識ソースを追加」→「お手本動画を登録」
2. `SNSのURLから取得`（Instagram/TikTok/YouTube/Twitter/X）または `ファイルをアップロード`
3. 登録後、動画詳細画面で「動画を解析する」をクリック

**ガイドラインの登録方法**
1. 「知識ソースを追加」→「ガイドラインをアップロード」
2. PDF・Word・PowerPoint・テキストファイルをアップロード
3. `.txt` ファイルのみ自動テキスト抽出対応（その他はファイル名のみ記録）

### ルール候補

AIが知識ソースから生成したルール候補を承認・却下します。

- **承認**：動画制作ルールとして正式採用
- **却下**：採用しない（90日後に自動削除）

### ルール管理

採用済みの動画制作ルールを管理します。

- カテゴリ別に整理
- 出典バッジ（🎬 お手本動画 / 📁 ガイドライン / ✏️ 手動追加）で根拠を確認
- 編集・削除・更新履歴の確認

### 動画検品

動画URLまたはファイルをアップロードして、登録済みルールと照合します。

1. タイトルと動画URL（またはファイル）を入力
2. 「検品する」をクリック
3. AI が各ルールに対して OK / NG / 要確認 を判定
4. 人による修正が可能（判定ボタンで上書き）

### 設定

- **SNS動画の取得**：Instagram取得に使用するブラウザを選択（Safari / Chrome / Firefox など）
- **AI設定**：ANTHROPIC_API_KEY の設定方法を案内
- **データ管理**：バックアップ方法・ログの説明

---

## 5. 2つのワークフロー

### ① 知識を育てるサイクル

```
お手本動画・ガイドラインを登録
    ↓ AIが解析（ffprobe + OCR + Whisper）
動画の特徴を取得
    ↓ AI（Claude）がルールを提案
ルール候補を生成
    ↓ 人が承認・却下
動画制作ルールに追加
    ↓ 繰り返すことで精度向上
```

### ② 動画を検品するサイクル

```
検品する動画をアップロード
    ↓ AIが解析（ffprobe + OCR + Whisper）
動画の特徴を取得
    ↓ Claude が各ルールと照合
検品結果（OK / NG / 要確認）を生成
    ↓ 人が確認・修正
検品レポートとして記録
```

---

## 6. 設定一覧

`.env.local` ファイルで設定します。

```bash
# Anthropic API キー（ルール候補生成・動画検品に必要）
ANTHROPIC_API_KEY=sk-ant-...

# ffmpeg / ffprobe のパス（省略でシステムPATHを検索）
# FFMPEG_PATH=/usr/local/bin/ffmpeg
# FFPROBE_PATH=/usr/local/bin/ffprobe

# yt-dlp のパス（省略でシステムPATHを検索）
# YT_DLP_PATH=/opt/homebrew/bin/yt-dlp

# フレーム抽出設定
VIDEO_FRAME_INTERVAL=1    # 何秒ごとに1フレーム抽出するか
VIDEO_FRAME_MAX=30        # 最大フレーム数

# OCR用フレーム解像度
VIDEO_OCR_MAX_HEIGHT=720  # フレームの最大高さ（px）。元動画が小さければそのまま。
```

SNS取得用ブラウザは **設定画面**（UIから変更可能）で管理します。

---

## 7. アーキテクチャ

### 動画解析パイプライン（2段階構成）

```
動画ファイル / URL
    │
    ▼ Stage 1: 特徴抽出（AI不使用・実測値）
    ├── ffprobe  → メタデータ（尺・解像度・FPS・コーデック・音声有無）
    ├── ffmpeg   → フレーム抽出（1秒ごと・720px以下に縮小）
    ├── Tesseract → OCR（日本語+英語・画面テキスト抽出）
    └── Whisper  → 音声文字起こし（ローカル実行・無料）
    │
    ▼ Stage 2: 意味理解（Claude AI使用）
    ├── ルール候補生成（お手本動画の場合）
    └── 検品判定（検品動画の場合）
```

### 解析ステータスの流れ

```
SNS動画の場合:
pending → downloading → pending → extracting_meta → extracting_frames
       → running_ocr → transcribing → generating_candidates → analyzed

ファイル・URL直接の場合:
pending → extracting_meta → extracting_frames
        → running_ocr → transcribing → generating_candidates → analyzed
```

### 技術スタック

| 役割 | 技術 |
|------|------|
| フレームワーク | Next.js 16 (webpack モード) |
| データベース | lowdb（JSONファイル: `data/db.json`） |
| AI（意味理解） | Claude Haiku（Anthropic API） |
| AI（文字起こし） | Whisper small（@xenova/transformers・ローカル実行） |
| OCR | Tesseract.js（日本語・英語対応） |
| 動画処理 | fluent-ffmpeg + システム ffmpeg |
| SNS取得 | yt-dlp |

---

## 8. ログ確認

### ターミナルログ（リアルタイム）

`npm run dev:log` で起動するとターミナルに表示されます。

### ログファイル

`data/dev.log` に蓄積されます（追記形式）。

```bash
# ログファイルをリアルタイムで監視（別ターミナルで実行）
tail -f /Users/otsuyu/Desktop/video-qa-platform/data/dev.log
```

### ログの読み方

```
[yt-dlp] ダウンロード開始: https://...     ← SNSダウンロード開始
[yt-dlp] ダウンロード完了: abc123.mp4      ← ダウンロード完了

[ffprobe] 開始: /path/to/video.mp4         ← メタデータ取得開始
[ffprobe] 完了: 30秒 1080×1920 h264 音声=true

[ffmpeg] フレーム抽出開始: 1秒ごと, 最大30枚, OCR解像度 高さ720px以下
[ffmpeg] フレーム抽出完了: 30枚

[Tesseract] OCR開始: 30枚のフレームを処理
[Tesseract] OCR完了: 5/30枚でテキスト検出

[Whisper] 音声文字起こし開始: ...
[Whisper] モデルをロード中...（初回のみ）
[Whisper] 文字起こし完了: 128文字
```

エラーはターミナルの赤字、またはログ内の `エラー:` で確認できます。

---

## 9. トラブルシューティング

### サーバーが起動しない

```bash
# Node.js のバージョン確認
node --version   # v20以上必要

# 依存パッケージを再インストール
npm install
```

### 動画解析が「動画情報取得中」で止まる

- ターミナルログで `[ffprobe] 開始:` の後に `完了:` が出ているか確認
- 30秒でタイムアウトしてエラーになる仕様（タイムアウトなら `[ffprobe] タイムアウト:` と表示）
- ffmpeg が正しくインストールされているか確認: `ffmpeg -version`

### Instagram の動画が取得できない

1. 設定画面で「使用するブラウザ」を選択
2. そのブラウザで instagram.com にログイン
3. 再度 SNS URL 入力を試みる

### ルール候補が生成されない

- `ANTHROPIC_API_KEY` が `.env.local` に設定されているか確認
- サーバーを再起動（設定変更後は再起動必要）

### Whisper が動かない（初回）

- 初回は最大244MBのモデルダウンロードが必要
- ターミナルに `[Whisper] モデルをロード中...` と表示されたまま数分かかる場合あり
- ネットワーク接続を確認

---

## 10. 既知の制限・注意事項

| 項目 | 制限 |
|------|------|
| ガイドライン自動解析 | `.txt` ファイルのみ対応。PDF・Word の自動テキスト抽出は未対応（Phase 2予定） |
| 動画ファイル解析 | URL直接アクセスは ffprobe に依存。認証が必要なURLは不可 |
| Instagram 取得 | ブラウザCookieが必要。非公開アカウント・ストーリーは不可 |
| 並列処理 | 複数動画を同時に解析する際の競合は未対応（順番に実行を推奨） |
| データバックアップ | 自動バックアップ機能なし。`data/db.json` を手動でコピーして管理 |
| Whisper 精度 | `whisper-small` モデルを使用。精度を上げるには `whisper-medium` への変更が可能（設定未対応・手動変更が必要） |

---

## 11. ディレクトリ構成

```
video-qa-platform/
├── app/
│   ├── api/                   # API エンドポイント
│   │   ├── videos/            # 動画登録・取得・解析
│   │   ├── production-rules/  # 動画制作ルール管理
│   │   ├── rule-candidates/   # ルール候補管理
│   │   ├── inspections/       # 動画検品
│   │   ├── guidelines/        # ガイドライン管理
│   │   ├── settings/          # 設定管理
│   │   └── dashboard/         # ダッシュボード集計
│   ├── production-rules/      # 画面: 動画制作ルール系
│   ├── inspections/           # 画面: 動画検品
│   ├── videos/                # 画面: 動画詳細（知識ソース詳細）
│   ├── guidelines/            # 画面: ガイドライン詳細・編集
│   └── settings/              # 画面: 設定
│
├── components/
│   └── Sidebar.tsx            # ナビゲーションサイドバー
│
├── lib/
│   ├── analysis/              # 動画解析パイプライン
│   │   ├── pipeline.ts        # パイプライン統括
│   │   ├── types.ts           # 解析データの型定義
│   │   └── extractors/
│   │       ├── video-meta.ts  # ffprobe: メタデータ取得
│   │       ├── frames.ts      # ffmpeg: フレーム抽出・縮小
│   │       ├── ocr.ts         # Tesseract: OCR
│   │       └── transcription.ts # Whisper: 音声文字起こし
│   ├── ai.ts                  # Claude AI: 意味理解・ルール生成
│   └── db.ts                  # データベース（lowdb）
│
├── types/
│   └── index.ts               # 型定義
│
├── data/
│   ├── db.json                # データベース本体（要バックアップ）
│   ├── dev.log                # ログファイル（npm run dev:log 使用時）
│   ├── frames/                # 抽出フレーム画像（一時ファイル）
│   └── uploads/
│       ├── videos/            # アップロード・ダウンロード動画
│       └── audio/             # Whisper用音声（一時ファイル）
│
├── docs/
│   └── OPERATIONS.md          # このファイル
│
├── .env.local                 # 環境変数（APIキーなど）
└── package.json
```

### 重要なファイル

| ファイル | 内容 | 備考 |
|---------|------|------|
| `data/db.json` | 全データ | **定期バックアップ推奨** |
| `.env.local` | APIキーなど | Git に含めないこと |
| `data/dev.log` | ログ | `npm run dev:log` 使用時のみ |
