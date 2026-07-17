#!/usr/bin/env bash
# Transcoda todos os vídeos existentes no diretório de uploads do VPS.
# Uso: bash transcode-existing-videos.sh [/caminho/para/uploads]
# Padrão (se não passar caminho): /var/www/rpshow/artifacts/api-server/uploads

set -euo pipefail

UPLOADS_DIR="${1:-/var/www/rpshow/artifacts/api-server/uploads}"
MIN_SIZE_MB=15
BITRATE="3000k"

if [ ! -d "$UPLOADS_DIR" ]; then
  echo "❌ Diretório não encontrado: $UPLOADS_DIR"
  echo "   Passe o caminho correto como argumento: bash transcode-existing-videos.sh /caminho/uploads"
  exit 1
fi

if ! command -v ffmpeg &>/dev/null; then
  echo "❌ ffmpeg não encontrado. Instale: apt install ffmpeg -y"
  exit 1
fi

# Extensões de vídeo a processar
VIDEO_EXTS=("mp4" "mov" "avi" "webm" "mkv" "mpeg" "mpg" "3gp")

echo "📁 Diretório: $UPLOADS_DIR"
echo "📦 Tamanho mínimo para transcodar: ${MIN_SIZE_MB}MB"
echo "🎯 Bitrate alvo: ${BITRATE}"
echo ""

total=0
converted=0
skipped=0
failed=0

for ext in "${VIDEO_EXTS[@]}"; do
  while IFS= read -r -d '' file; do
    size_bytes=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
    size_mb=$(( size_bytes / 1024 / 1024 ))
    total=$(( total + 1 ))

    if [ "$size_mb" -lt "$MIN_SIZE_MB" ]; then
      echo "⏭️  $(basename "$file") — ${size_mb}MB (< ${MIN_SIZE_MB}MB, pulando)"
      skipped=$(( skipped + 1 ))
      continue
    fi

    echo "🔄 $(basename "$file") — ${size_mb}MB → transcodando..."
    tmp="${file}.transcoding.mp4"

    if ffmpeg -i "$file" \
        -c:v libx264 \
        -b:v "$BITRATE" \
        -maxrate 4500k \
        -bufsize 6000k \
        -preset fast \
        -an \
        -movflags +faststart \
        -y "$tmp" \
        2>/dev/null; then
      new_size_mb=$(( $(stat -c%s "$tmp" 2>/dev/null || stat -f%z "$tmp" 2>/dev/null || echo 0) / 1024 / 1024 ))
      mv "$tmp" "$file"
      echo "   ✅ ${size_mb}MB → ${new_size_mb}MB"
      converted=$(( converted + 1 ))
    else
      echo "   ❌ falhou — arquivo original mantido"
      rm -f "$tmp"
      failed=$(( failed + 1 ))
    fi

  done < <(find "$UPLOADS_DIR" -maxdepth 1 -type f -iname "*.${ext}" -print0 2>/dev/null)
done

echo ""
echo "=============================="
echo "✅ Convertidos : $converted"
echo "⏭️  Pulados     : $skipped"
echo "❌ Falhas      : $failed"
echo "📊 Total       : $total"
echo "=============================="
