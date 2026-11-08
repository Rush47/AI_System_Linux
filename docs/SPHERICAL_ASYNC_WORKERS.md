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
