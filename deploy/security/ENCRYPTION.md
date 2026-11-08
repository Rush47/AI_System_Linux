# AI Linux — encryption without interactive password at each boot

## Scope
This repository can configure application encryption, but cannot encrypt a running host disk by committing code. Root filesystem encryption requires installation-time provisioning or an offline migration with verified backups.

## Recommended deployment
1. Fresh Ubuntu host: enable LUKS2 full-disk encryption in the installer. Store a unique recovery key **offline**, never in Git, env files, or a chat.
2. Where supported by physical TPM2 and systemd-cryptenroll, enroll TPM2 for automatic unlock with measured-boot/PCR policy after validating Secure Boot and recovery. TPM2-only unlock is not equivalent to a user-authenticated boot. Never remove the recovery key.
3. In VMs, Codespaces, and managed containers, check whether the provider encrypts underlying disks; TPM devices and host disk access may be unavailable. Do not run cryptsetup format against mounted production volumes.
4. Expose web services only through an HTTPS reverse proxy (valid TLS certificates), enable authenticated access to all sensitive endpoints, and restrict internal Ollama/agent APIs to a private network. TLS is encryption in transit, **not** login authentication.
5. Keep API keys in a managed secret store or protected host secrets (not Git); use workload identity when available, rotate exposed credentials.
6. Encrypt backups independently using an age public recipient or managed KMS key. Test restore and keep the recovery identity/key outside the server.
7. Review access controls: the current control-center includes unauthenticated read endpoints (e.g. fleet/projects) and shared bearer tokens for writes. **Do not expose the current service directly to the public internet.** A reverse proxy with authentication is required until per-user/device authorization is implemented.

## Read-only audit
Run `bash deploy/security/check-encryption.sh` on the actual Linux host (not inside the control-center container). This only reports mount, LUKS and TPM indicators; it never changes partitions or keys.

## What is not done
No host volume has been encrypted, no TPM enrollment performed, no HTTPS proxy deployed, and no secrets migrated. These require the real deployment environment and verification.
