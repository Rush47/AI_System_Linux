#!/usr/bin/env bash
# Non-destructive encryption readiness check. Does NOT format or enroll keys.
set -euo pipefail
echo "AI Linux — encryption readiness (read-only)"
if [[ "$(uname -s)" != Linux ]]; then echo "Linux required"; exit 1; fi
echo "Root mount:"; findmnt -no SOURCE,FSTYPE,OPTIONS /
echo "Block devices:"; lsblk -o NAME,TYPE,FSTYPE,MOUNTPOINTS
echo "Root encryption mapping:"; if command -v cryptsetup >/dev/null; then sudo cryptsetup status "$(basename "$(findmnt -no SOURCE /)")" 2>/dev/null || echo "Cannot confirm LUKS on root (inspect manually)"; else echo "cryptsetup not installed"; fi
echo "TPM2:"; if [[ -e /dev/tpmrm0 || -e /dev/tpm0 ]]; then echo "TPM device present"; else echo "No TPM device exposed (common in containers/VMs)"; fi
echo "Secure Boot:"; if command -v mokutil >/dev/null; then mokutil --sb-state || true; else echo "mokutil unavailable"; fi
echo "Encrypted filesystems:"; lsblk -f
echo "No changes were made. For fresh Ubuntu installations use LUKS2 during installer setup; configure TPM2 enrollment only with tested recovery key and offline backup."
