# Root terminal and kernel management — implementation contract

## Scope
The AI Linux Control Center needs an **actual interactive Ubuntu host PTY**, not a simulated browser terminal. Root sessions must be explicit and restricted to authenticated administrators. The web UI must never treat a chat-model answer as authorization to execute host commands.

## Host architecture
1. Local host terminal gateway running as a dedicated system service, bound to a Unix socket. Browser clients connect through an authenticated HTTPS WebSocket gateway with origin checks, CSRF/session protection, and short-lived session tickets.
2. Allocate a real PTY for each user session; support terminal resize, UTF-8, streaming stdout/stderr, exit codes, interruption, and session termination.
3. Default shell executes under a non-root system account. Root shell is a distinct elevated session established only after fresh admin authentication and an explicit UI action. Do not store root passwords in the browser or repository.
4. Enforce session timeouts, per-user concurrency limits, and audit trails. Redact secrets from logs and do not record raw terminal keystrokes by default.
5. Keep the gateway off public interfaces until TLS, authentication and host access controls are configured.

## Kernel operations
Expose real host data: `uname -r`, `/proc/version`, `/boot`, loaded modules (`lsmod`), kernel logs with appropriate privileges (`journalctl -k`), bootloader entries and current default.
Provide separately gated actions for kernel package installation, DKMS/module build and signing, bootloader updates, selecting a new default kernel, and reboot. Show planned changes and retain the previous bootable kernel entry for rollback. Kernel source compilation and deployment require build dependencies and adequate storage; a reboot is necessary to activate a new kernel. Do not offer an in-place arbitrary kernel rewrite.

## AI agent execution
Agents may propose commands and create tasks, but privileged execution requires a policy-aware root service with audited authorization. Pre-approved low-risk operations can run automatically; destructive, security-sensitive, kernel-changing and reboot operations require explicit administrative confirmation.

## Current state
Design contract only. The existing read-only `deploy/host-worker` service is not a root shell. No PTY gateway, kernel build pipeline, root shell, or Ubuntu runtime has been deployed or tested.
