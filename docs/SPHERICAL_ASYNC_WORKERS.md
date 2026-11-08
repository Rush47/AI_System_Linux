# AI Linux — Spherical Async Worker Architecture

Status: design specification, not a deployed service.

## Principles
- Ubuntu host is the source of truth. No simulated health metrics or agent availability.
- Spherical means event-driven, multi-source **authorized** observability (systemd, journald, CPU/RAM, disk, approved application events); not unrestricted surveillance.
- Polymorphic workers implement the same typed task contract with specialized handlers.
- Asynchronous workers consume a durable task queue with IDs, retries, backoff, deadlines, cancellation and idempotency keys.
- Asymmetric scheduling assigns differing priorities, quotas, resource budgets and privileges per worker.
- Four original agent runtimes (Aria, Alex, Astyria, Aurelius) must be connected through authenticated endpoints; never impersonate or substitute them.
- Ollama 8B primary; 4B only when primary fails. Record which model answered.

## Worker roles
| Worker | Inputs | Outputs | Privileges |
| --- | --- | --- | --- |
| Observer | approved host metrics, journald, service state | timestamped events | read-only |
| Vision | user-selected images / explicitly shared screen | structured observations | no host root |
| System | signed administrative task requests | results, stdout/stderr, exit status | narrowly scoped polkit/sudo rules |
| Async | queue messages | task lifecycle updates | unprivileged |
| Memory | opted-in conversations and task records | indexed records | scoped storage |
| Recovery | failing supervised services | recovery proposals / authorized restarts | narrowly scoped service actions |
| Security | policy and audit events | deny/allow decisions and logs | policy management only |

## Task contract
```json
{
  "task_id": "uuid",
  "requester": "system|aria|alex|astyria|aurelius|user",
  "worker_type": "observer|vision|system|async|memory|recovery|security",
  "action": "typed.action",
  "arguments": {},
  "priority": 50,
  "deadline": "ISO-8601",
  "requires_approval": false
}
```

## Execution model
1. Host service supervised by systemd; no Docker socket or privileged host mounts in chat container.
2. Authenticated local IPC (Unix socket) between gateway and workers; explicit authorization for each task.
3. Dedicated service users, systemd hardening, cgroups resource limits and per-worker scopes.
4. Root-only actions through a small allowlisted host executor; no free-form model-generated shell passed to root.
5. High-risk changes (kernel, packages, firewall, user accounts, secrets, deletion) require explicit human approval and audit log.
6. Observable state: queued/running/completed/failed/cancelled, heartbeat, retry count, real logs, trace IDs.
7. Background work requires actually running systemd units and persistent queue; a GitHub commit alone does not start them.

## Next implementation stages
1. Host agent and read-only observer with systemd units.
2. Durable queue and typed worker API.
3. Policy-based administrative executor.
4. Chat tool calls, interactive task cards and live logs.
5. Real original-agent endpoint adapters and end-to-end Ubuntu tests.

## Spherical Vision 360 — remote desktops and devices

- Register each Ubuntu desktop, authorized remote desktop session, browser session, and mobile screen-share as a separate source with a unique device ID.
- The source agent captures only an explicitly shared screen/window or authorized diagnostic stream; indicate capture state visibly and allow immediate revoke.
- Each source gets a separate asynchronous vision worker and independent frame-rate, bandwidth, memory, CPU and retention budgets.
- The orchestrator correlates timestamped observations and device health across sources without pretending to see unavailable cameras, hidden windows or disconnected devices.
- Remote viewing and remote control are separate capabilities and permissions. Control is disabled by default and requires an authenticated user-granted session.
- Support WebRTC for low-latency video, with authenticated signaling, encryption in transit, expiring session credentials and reconnect/backpressure logic.
- Never expose remote desktop or privileged system-control endpoints directly to the public Internet; use authenticated gateway or VPN.
- Keep a device inventory with connected/disconnected/permission-denied statuses derived from actual heartbeats, never simulated statuses.
- Do not retain screen captures or use them for long-term AI memory without an explicit user setting and retention policy.
- Mobile devices require platform-specific screen sharing permissions; no bypass of Android or OS privacy controls.
- Proposed UI: Spherical Vision tab, source selector, live preview, per-device diagnostics, AI analysis request, stop sharing, and optional separately authorized remote control.

Implementation status: specification only; no real screen capture, WebRTC gateway or device agents deployed yet.

## Autonomous agent daemons and privileged host execution

**Target only — not deployed.** Aria, Alex, Astyria and Aurelius each receive:
- an independently supervised systemd service with restart-on-failure and startup at boot;
- a persistent, asynchronous job queue, task deadlines, retries, cancellation, and per-agent activity logs;
- an authenticated interface to a host administrative executor, capable of performing root-level tasks when permitted;
- per-agent identity and policy so one agent cannot silently impersonate another;
- autonomous execution of preapproved low-risk tasks without needing the chat browser open;
- explicit approval gates for destructive operations, kernel modification, security policy changes, credential access and irreversible actions;
- a kill switch, task pause and audit trail visible in the Control Center.

Run the agent processes as dedicated non-root service users with systemd sandboxing; grant privileged operations via a narrow, audited root-owned executor. Never grant unrestricted passwordless sudo or expose a root shell to untrusted model output.

Integration of the four **original** AI agent runtimes is deferred until the user imports the application into Google AI Studio. Service scaffolding must not claim that any agent is connected or running before a real endpoint and host have been configured and verified.
