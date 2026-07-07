FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

# ── システム依存パッケージ ──────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg \
    tesseract-ocr \
    tesseract-ocr-jpn \
    tesseract-ocr-eng \
    python3 \
    python3-pip \
    python3-venv \
    git \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js 20 ──────────────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# ── yt-dlp ──────────────────────────────────────────────────────────────
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod +x /usr/local/bin/yt-dlp

# ── アプリケーション ─────────────────────────────────────────────────────
WORKDIR /app

COPY package*.json ./
# ビルド時は devDependencies も必要（@tailwindcss/postcss 等）
RUN npm ci

COPY . .
RUN npm run build

# ビルド後に devDependencies を削除してイメージを軽量化
RUN npm prune --omit=dev

# ── データディレクトリ ───────────────────────────────────────────────────
RUN mkdir -p data/uploads data/frames data/logs data/tessdata

EXPOSE ${PORT:-3000}

CMD ["npm", "start"]
