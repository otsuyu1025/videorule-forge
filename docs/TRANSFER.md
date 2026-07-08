# VideoRule Forge — システム譲渡・引き継ぎガイド

このドキュメントは、本システムを第三者に譲渡・引き継ぐ際に必要なすべての情報をまとめたものです。

---

## 1. システム概要

**VideoRule Forge** は、動画制作ルールを管理・育成し、AI による動画品質検品を行うプラットフォームです。

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js 16（App Router）|
| データベース | lowdb（JSONファイル）→ 将来 PostgreSQL 移行予定 |
| ホスティング | Railway |
| フレーム画像ストレージ | Cloudflare R2（任意） |
| AI | Anthropic Claude Haiku 4.5 |
| 認証 | Google OAuth（NextAuth.js v4） |

---

## 2. 引き継ぎに必要なアカウント一覧

引き継ぎ先が準備すべきアカウントと、その用途です。

| サービス | 用途 | 無料枠 |
|---------|------|--------|
| [Railway](https://railway.app) | アプリのホスティング・実行 | $5/月〜 |
| [Google Cloud Console](https://console.cloud.google.com) | Google ログイン認証 | 無料 |
| [Anthropic Console](https://console.anthropic.com) | AI 解析（ルール生成・動画検品） | 従量課金 |
| [Cloudflare](https://cloudflare.com)（任意） | フレーム画像の永続ストレージ | 10GB 無料 |
| [GitHub](https://github.com)（任意） | コードの保管・Railway 自動デプロイ | 無料 |

---

## 3. Railway の引き継ぎ手順

### 3-1. 方法の選択

**方法 A（推奨）: GitHub リポジトリを引き継ぎ先に fork / transfer してもらい、Railway で新規デプロイ**

1. GitHub リポジトリを引き継ぎ先アカウントに transfer または fork
2. Railway で「New Project」→「Deploy from GitHub repo」
3. Dockerfile ビルドが自動実行される
4. Volume を追加（下記 3-2 参照）
5. 環境変数を設定（下記 4 参照）

**方法 B: Railway のサービスを直接 transfer**

Railway ダッシュボード → サービス → Settings → Transfer → 引き継ぎ先の Railway アカウントに移管

---

### 3-2. Railway Volume（データ永続化）の確認

**Volume が設定されていないとデータが消えます。**

Railway ダッシュボード → サービス → **Volumes** で `/app/data` に Volume が存在することを確認してください。

なければ「Add Volume」→ Mount Path: `/app/data` で追加。

---

## 4. 環境変数リファレンス（Railway Variables）

Railway ダッシュボード → サービス → **Variables** で設定します。

### 4-1. 必須

| 変数名 | 説明 | 取得方法 |
|--------|------|---------|
| `ANTHROPIC_API_KEY` | AI 解析用 API キー | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | 下記 5 参照 |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット | 下記 5 参照 |
| `NEXTAUTH_SECRET` | セッション暗号化キー | `openssl rand -base64 32` で生成 |
| `NEXTAUTH_URL` | アプリの公開 URL | `https://YOUR-APP.up.railway.app` |

### 4-2. アクセス制限（任意）

| 変数名 | 説明 | 設定例 |
|--------|------|--------|
| `ALLOWED_DOMAINS` | ログインを許可するメールドメイン（カンマ区切り）。**未設定 = すべての Google アカウントを許可** | `company.co.jp` |

**ドメイン制限の追加・変更方法：**

```
# 例1: 1社のみ許可
ALLOWED_DOMAINS=company-a.co.jp

# 例2: 複数社を許可
ALLOWED_DOMAINS=company-a.co.jp,company-b.co.jp

# 例3: 制限なし（全アカウント）
# → 変数自体を削除するか、空のまま
```

変更後は Railway が自動的に再デプロイします。再デプロイ後すぐに反映されます。

### 4-3. 機能フラグ（任意）

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `DISABLE_TRANSCRIPTION` | `true` にすると Whisper 音声文字起こしを無効化（メモリ節約） | 無効（Whisper 使用） |
| `WHISPER_MODEL` | Whisper モデル名。`Xenova/whisper-tiny`（39MB）に変更するとメモリを節約できる | `Xenova/whisper-small`（244MB） |
| `ENABLE_SNS_DOWNLOAD` | `true` にすると SNS 動画 URL 取得機能を有効化。著作権・利用規約に注意 | `false`（非表示） |
| `MAX_VIDEO_SIZE_MB` | アップロード動画の上限サイズ（MB） | `200` |

### 4-4. フレーム画像ストレージ（任意）

Cloudflare R2 を使用する場合に設定。未設定の場合はサーバーローカルに保存（Volume 必須）。

| 変数名 | 説明 |
|--------|------|
| `R2_ACCOUNT_ID` | Cloudflare アカウント ID |
| `R2_ACCESS_KEY_ID` | R2 API トークンのアクセスキー ID |
| `R2_SECRET_ACCESS_KEY` | R2 API トークンのシークレット |
| `R2_BUCKET` | R2 バケット名 |

### 4-5. その他

| 変数名 | 説明 | デフォルト |
|--------|------|-----------|
| `VIDEO_FRAME_INTERVAL` | フレーム抽出間隔（秒） | `1` |
| `VIDEO_FRAME_MAX` | 最大フレーム数 | `30` |
| `VIDEO_OCR_MAX_HEIGHT` | OCR 用フレームの最大高さ（px） | `720` |
| `VISION_FRAME_INTERVAL` | Vision OCR（AI によるテキスト読み取り）の解析間隔（秒）。何秒ごとに1枚のフレームを AI に送るか。**設定画面からも変更可能** | `3` |
| `CLEANUP_SECRET` | フレーム削除 API の認証キー | なし |

---

## 5. Railway プランとメモリ制限

### 5-1. 現在の制限（Trial / Hobby プラン：RAM 512MB）

Railway の Trial・Hobby プランは RAM が **512MB** に制限されています。この制限により、以下の機能制約が生じています。

| 機能 | 現状 | 原因 |
|------|------|------|
| 音声文字起こし（Whisper） | **無効**（DISABLE_TRANSCRIPTION=true） | Whisper モデルが 244MB を消費するため |
| 動画アップロード上限 | **200MB**（環境変数で設定） | 大きいファイルほど処理中のメモリ消費が増えるため |
| Vision OCR フレーム数 | **デフォルト3秒ごとに1枚・最大10枚**（設定画面で変更可） | フレーム数が多いと API 呼び出しが大きくなり処理時間・費用が増えるため |
| 同時検品 | **1件のみ推奨** | 複数同時処理はメモリ不足でクラッシュするリスクがある |
| 処理可能な動画の長さ | **目安として5分以内** | 長い動画ほどフレーム数・OCR処理が増えメモリを多く使う |

> **現在の安定動作確認済み範囲：** 13秒・2.7MB の動画を1件ずつ検品する用途。

---

### 5-2. プランの比較と費用

| | Trial | Hobby | **Pro（推奨）** |
|---|---|---|---|
| 月額基本料 | 無料（$5クレジット付き） | $5/月 | **$20/月** |
| RAM | 512MB | 512MB | **最大 32GB（設定次第）** |
| vCPU | 0.5 | 0.5 | **最大 32vCPU** |
| Volume（ストレージ） | 5GB | 5GB | より大容量 |
| 稼働課金 | クレジット消費 | 約 $10〜15/月（24時間稼働） | 使用量に応じて |
| Whisper 有効化 | ✗ | ✗ | **✓** |
| 大容量動画の安定処理 | △ | △ | **✓** |
| 複数同時検品 | ✗ | ✗ | **✓** |

**Pro へのアップグレード方法：**
Railway ダッシュボード → 左下のアカウント名 → **「Upgrade to Pro」**

Pro にアップグレードした後、サービスの Settings → Resources で RAM を 1GB〜2GB 程度に設定することを推奨します（デフォルトのままでは 512MB 相当になる場合があります）。

---

### 5-3. Pro にすることで可能になること

**① 音声文字起こし（Whisper）が使えるようになる**

ナレーション・セリフの内容をルール判定に含められます。「特定のキャッチコピーを読み上げているか」「禁止ワードが含まれていないか」といったルールが機能するようになります。有効化手順は後述の「音声文字起こしの有効化」を参照してください。

**② 大きな動画を安定して処理できる**

目安として 30 分以内の動画まで安定処理できるようになります（環境変数 `MAX_VIDEO_SIZE_MB` の引き上げも必要）。

**③ 複数人が同時に使えるようになる**

現在は同時に複数の検品リクエストが来るとクラッシュリスクがあります。Pro + RAM 増量により並行処理が安定します。

---

### 5-4. ストレージ（Volume）の注意点

検品のたびにフレーム画像が `/app/data/frames/` に蓄積されます。目安として1回の検品あたり約 1〜2MB 増加します。

Hobby/Trial の Volume 上限は **5GB**。数百回以上の検品を行う場合は定期的な削除が必要です（現時点では手動対応）。

---

## 6. 音声文字起こし（Whisper）の有効化

### 5-1. 現状と制約

Whisper モデル（`Xenova/whisper-small`）はロード時に **244MB** のメモリを消費します。Railway Hobby プラン（512MB RAM）では動画ファイルと合わせてメモリ不足になるため、**デフォルトは無効**（`DISABLE_TRANSCRIPTION=true`）にしています。

### 5-2. 有効化する手順

**ステップ 1: Railway を Pro プランにアップグレード**

Railway ダッシュボード → Settings → Plan → **Pro**（$20/月〜）にアップグレードします。

Pro プランは RAM が最大 8GB まで利用でき、Whisper を安定して動かせます。

**ステップ 2: Railway Variables を更新**

| 変数名 | Hobby（現状） | Pro（Whisper 有効） |
|--------|------------|-------------------|
| `DISABLE_TRANSCRIPTION` | `true` | **削除 or 空** |
| `WHISPER_MODEL` | （未設定）| （未設定のまま = `whisper-small` 使用） |

Railway Variables から `DISABLE_TRANSCRIPTION` を削除するか、値を空にすると自動で再デプロイされ、次の動画解析から音声文字起こしが有効になります。

**ステップ 3: 動作確認**

動画検品画面の警告バナー（「⚠️ 音声文字起こしは現在無効です」）が消えていれば有効化されています。

### 5-3. メモリを節約しながら有効化したい場合

Pro プランに上げずに試したい場合は、軽量モデルを使います：

```
WHISPER_MODEL=Xenova/whisper-tiny
DISABLE_TRANSCRIPTION=（削除）
```

| モデル | サイズ | 精度 |
|--------|--------|------|
| `Xenova/whisper-tiny` | 39MB | 低め |
| `Xenova/whisper-base` | 74MB | 中程度 |
| `Xenova/whisper-small`（デフォルト） | 244MB | 高め |

ただし Railway Hobby プランでは `whisper-tiny` でも動画ファイル次第でメモリ不足になる可能性があります。安定運用には Pro プランを推奨します。

---

## 7. Google Cloud Console の設定手順

Google ログイン機能を動作させるために必要な設定です。

1. [https://console.cloud.google.com](https://console.cloud.google.com) にアクセス
2. 「プロジェクトを作成」（任意の名前）
3. 左メニュー「APIとサービス」→「OAuth 同意画面」
   - User Type: 外部
   - アプリ名・メールアドレスを入力して保存
4. 「認証情報」→「認証情報を作成」→「OAuth クライアント ID」
   - アプリケーションの種類: **ウェブアプリケーション**
   - 承認済みリダイレクト URI に以下を追加：
     ```
     https://YOUR-APP.up.railway.app/api/auth/callback/google
     ```
     （ローカル開発も行う場合は `http://localhost:3000/api/auth/callback/google` も追加）
5. 作成後に表示される **クライアント ID** と **クライアントシークレット** を Railway Variables に設定

> **注意**: アプリが「テスト」モードの場合、ログインできるのは OAuth 同意画面で追加したテストユーザーのみです。本番運用では「本番環境に公開」してください。

---

## 8. データのバックアップと移行

### 6-1. データベース（db.json）

現在のデータは Railway Volume 内の `/app/data/db.json` に保存されています。

**バックアップ方法:**

```bash
# Railway CLI でファイルをダウンロード
railway run cat /app/data/db.json > backup-$(date +%Y%m%d).json
```

または Railway ダッシュボードの Shell 機能で同様の操作が可能です。

**移行手順（新しい Railway サービスへ）:**

1. 旧環境の `db.json` をダウンロード
2. 新環境の Volume に `db.json` をアップロード
3. 新環境で動作確認

### 6-2. フレーム画像（Cloudflare R2 使用の場合）

R2 のバケットを新しい Cloudflare アカウントに移行するか、新しいバケットを作成して設定を更新します。

---

## 9. 死活監視（UptimeRobot）

現在 UptimeRobot で以下のエンドポイントを監視しています：

- **URL**: `https://YOUR-APP.up.railway.app/api/health`
- **監視間隔**: 5分
- **期待レスポンス**: `{"status":"ok"}`

引き継ぎ後は UptimeRobot の通知先メールアドレスを変更してください。

---

## 10. 再デプロイ・コード更新の方法

GitHub と Railway を連携している場合、**main ブランチへの push が自動デプロイ**されます。

```bash
git add .
git commit -m "変更内容"
git push origin main
# → Railway が自動でビルド・デプロイ
```

手動でデプロイする場合は Railway ダッシュボード → **Deploy** → 「Redeploy」。

---

## 11. 月額費用の目安

| サービス | 費用 |
|---------|------|
| Railway（Hobby プラン） | $5/月 |
| Anthropic API | 従量課金（動画1本あたり約 $0.01〜$0.05） |
| Cloudflare R2 | 10GB まで無料、以降 $0.015/GB/月 |
| Google Cloud（OAuth） | 無料 |
| UptimeRobot | 無料（50モニターまで） |
| **合計（標準的な利用）** | **$5〜10/月** |

---

## 12. よくある問題と対処法

| 症状 | 原因 | 対処 |
|------|------|------|
| ログインできない | `GOOGLE_CLIENT_ID` / `NEXTAUTH_SECRET` 未設定 | Railway Variables を確認 |
| ログインできない（特定ドメインのみ） | `ALLOWED_DOMAINS` に含まれていない | Variables を更新して再デプロイ |
| 動画アップロード後にクラッシュ | メモリ不足（Whisper モデル） | `DISABLE_TRANSCRIPTION=true` を設定 |
| データが消えた | Volume が未設定 | Railway で `/app/data` に Volume を追加 |
| ビルドが失敗する | Docker ビルドエラー | Railway の Deploy ログを確認 |
| AI 解析が動かない | `ANTHROPIC_API_KEY` 未設定 or 残高不足 | Anthropic Console で確認 |
