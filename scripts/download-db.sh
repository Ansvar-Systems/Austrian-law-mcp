#!/bin/bash
# Download database from GitHub Releases.
#
# package.json's version is the preferred release tag; if that release
# does not have the asset (release-tag drift between npm version bumps
# and the manual GitHub Releases process), fall back to the most recent
# release that does. The fallback prevents CI from failing every time
# package.json gets bumped before the next DB rebuild ships.
set -euo pipefail

VERSION=$(node -p "require('./package.json').version")
REPO="Ansvar-Systems/Austrian-law-mcp"
TAG="v${VERSION}"
ASSET="database.db.gz"
OUTPUT="data/database.db"

if [ -f "$OUTPUT" ]; then
  echo "[download-db] Database already exists at $OUTPUT, skipping download"
  exit 0
fi

mkdir -p data

try_download() {
  local tag="$1"
  local url="https://github.com/${REPO}/releases/download/${tag}/${ASSET}"
  echo "[download-db] Trying: ${url}"
  local tmp_gz="${OUTPUT}.gz.tmp"
  if curl -fSL --retry 3 --retry-delay 5 -o "$tmp_gz" "$url"; then
    if gunzip -c "$tmp_gz" > "${OUTPUT}.tmp"; then
      rm -f "$tmp_gz"
      return 0
    fi
    rm -f "$tmp_gz" "${OUTPUT}.tmp"
  fi
  return 1
}

if try_download "$TAG"; then
  USED_TAG="$TAG"
else
  echo "[download-db] ${TAG} asset not found, querying latest release"
  LATEST_TAG=$(curl -fSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | grep -E '"tag_name":' | head -1 | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
  if [ -z "$LATEST_TAG" ]; then
    echo "[download-db] FAILED: could not determine latest release tag for ${REPO}" >&2
    exit 1
  fi
  if [ "$LATEST_TAG" = "$TAG" ]; then
    echo "[download-db] FAILED: ${ASSET} not available on ${TAG} (already the latest)" >&2
    exit 1
  fi
  if try_download "$LATEST_TAG"; then
    USED_TAG="$LATEST_TAG"
    echo "[download-db] WARNING: package.json declares ${VERSION} but using release ${LATEST_TAG} — republish ${TAG} when convenient."
  else
    echo "[download-db] FAILED: ${ASSET} not available on ${TAG} or ${LATEST_TAG}" >&2
    exit 1
  fi
fi

mv "${OUTPUT}.tmp" "$OUTPUT"
SIZE=$(ls -lh "$OUTPUT" | awk '{print $5}')
echo "[download-db] Database ready: $OUTPUT ($SIZE) from ${USED_TAG}"
