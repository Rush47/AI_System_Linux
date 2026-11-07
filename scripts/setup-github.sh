#!/usr/bin/env bash
set -euo pipefail

host="github.com"

if ! command -v gh >/dev/null 2>&1; then
  printf 'GitHub CLI (gh) is required. Install it first, for example: sudo apt install gh\n' >&2
  exit 1
fi

if ! gh auth status --hostname "$host" >/dev/null 2>&1; then
  if [[ ! -t 0 && ! -t 1 && ! -t 2 ]] || ! {
    exec 3<>/dev/tty
  } 2>/dev/null; then
    printf 'Run this script from an interactive terminal so the token can be entered securely.\n' >&2
    exit 1
  fi

  printf 'Paste your GitHub classic personal access token (input hidden): ' >&3
  IFS= read -r -s token <&3
  printf '\n' >&3
  exec 3>&-

  if [[ -z "$token" ]]; then
    printf 'No token provided; authentication was not changed.\n' >&2
    exit 1
  fi

  if ! printf '%s' "$token" | gh auth login --hostname "$host" --git-protocol https --with-token; then
    unset token
    printf 'GitHub authentication failed. Check the token and its scopes, then retry.\n' >&2
    exit 1
  fi
  unset token
fi

gh auth setup-git --hostname "$host"
gh auth status --hostname "$host"
printf 'GitHub CLI and Git HTTPS authentication are configured for %s.\n' "$host"
