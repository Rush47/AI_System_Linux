#!/usr/bin/env bash
set -euo pipefail
# Download official AILinux ISO after copying its current direct URL from https://ailinux.me/
ISO_NAME="ailinux-26.04-amd64-20261013T144048Z.iso"
SHA256="de744684375ccbc15d6be45acf567cb8549475e9c57cf812c1aed47a8da4b2c7"
URL="${1:-}"
if [[ -z "$URL" || "$URL" != https://* ]]; then
  echo "Usage: bash scripts/download-ailinux.sh https://official-direct-iso-url" >&2
  exit 2
fi
mkdir -p downloads
curl --fail --location --retry 3 --output "downloads/$ISO_NAME" "$URL"
echo "$SHA256  downloads/$ISO_NAME" | sha256sum -c -
echo "ISO downloaded and verified: downloads/$ISO_NAME"
