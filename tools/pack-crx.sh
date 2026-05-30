#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$ROOT_DIR/builds/crx"
KEY_DIR="${CRX_KEY_DIR:-$(dirname "$ROOT_DIR")/4chan-xt.keys}"
KEY_FILE="${CRX_KEY_FILE:-}"
PACKER_BIN="${CRX_PACKER_BIN:-}"

if [[ ! -d "$BUILD_DIR" ]]; then
  echo "Missing build directory: $BUILD_DIR" >&2
  echo "Run: npm run build:crx" >&2
  exit 1
fi

if [[ -z "$PACKER_BIN" ]]; then
  for bin in chromium chromium-browser google-chrome google-chrome-stable; do
    if command -v "$bin" >/dev/null 2>&1; then
      PACKER_BIN="$bin"
      break
    fi
  done
fi

if [[ -z "$PACKER_BIN" ]]; then
  echo "No Chromium/Chrome binary found. Set CRX_PACKER_BIN." >&2
  exit 1
fi

if [[ -z "$KEY_FILE" ]]; then
  if [[ ! -d "$KEY_DIR" ]]; then
    echo "Missing key directory: $KEY_DIR" >&2
    echo "Set CRX_KEY_DIR or CRX_KEY_FILE." >&2
    exit 1
  fi

  mapfile -t pem_files < <(find "$KEY_DIR" -maxdepth 1 -type f -name '*.pem' | sort)
  if [[ "${#pem_files[@]}" -eq 0 ]]; then
    echo "No .pem key found in: $KEY_DIR" >&2
    echo "Set CRX_KEY_FILE to an explicit key path." >&2
    exit 1
  fi

  KEY_FILE="${pem_files[0]}"
  if [[ "${#pem_files[@]}" -gt 1 ]]; then
    echo "Multiple keys found in $KEY_DIR; using: $KEY_FILE" >&2
    echo "Set CRX_KEY_FILE to choose a different key." >&2
  fi
fi

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Key file not found: $KEY_FILE" >&2
  exit 1
fi

EXT_NAME="$(node -e "const fs=require('fs'); const p=require('path'); const pkg=JSON.parse(fs.readFileSync(p.join(process.argv[1], 'package.json'), 'utf8')); process.stdout.write(pkg.meta.path);" "$ROOT_DIR")"
VERSION="$(node -e "const fs=require('fs'); const p=require('path'); const v=JSON.parse(fs.readFileSync(p.join(process.argv[1], 'version.json'), 'utf8')); process.stdout.write(v.version);" "$ROOT_DIR")"
OUT_SUFFIX="${CRX_OUTPUT_SUFFIX:-}"
OUT_FILE="${CRX_OUTPUT_FILE:-$ROOT_DIR/builds/${EXT_NAME}-${VERSION}${OUT_SUFFIX}.crx}"

TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/crx-pack.XXXXXX")"
trap 'rm -rf "$TMP_DIR"' EXIT

WORK_DIR="$TMP_DIR/$EXT_NAME"
cp -R "$BUILD_DIR" "$WORK_DIR"

args=(
  "--pack-extension=$WORK_DIR"
  "--pack-extension-key=$KEY_FILE"
)
if [[ "$(id -u)" -eq 0 ]]; then
  args+=(--no-sandbox)
fi

"$PACKER_BIN" "${args[@]}"

PACKED_FILE="$TMP_DIR/$EXT_NAME.crx"
if [[ ! -f "$PACKED_FILE" ]]; then
  echo "Packing failed: expected output not found at $PACKED_FILE" >&2
  exit 1
fi

mv "$PACKED_FILE" "$OUT_FILE"
echo "Packed CRX written to: $OUT_FILE"
