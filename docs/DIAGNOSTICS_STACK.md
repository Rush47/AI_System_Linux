# AI Linux diagnostics stack

This optional stack prepares **Arize Phoenix**, **Prometheus**, **node-exporter** and **Grafana**. Netdata and cAdvisor are candidates for later integration, not installed by this stack.

## Launch
From repository root, after Docker and Compose are installed:
```bash
docker compose -f docker-compose.diagnostics.yml config
docker compose -f docker-compose.diagnostics.yml up -d
docker compose -f docker-compose.diagnostics.yml ps
```

Localhost dashboards: Phoenix http://127.0.0.1:6006, Prometheus http://127.0.0.1:9090, Grafana http://127.0.0.1:3001. For remote access use authenticated SSH forwarding or a secured reverse proxy, not public port forwarding.

Phoenix requires **explicit OpenTelemetry/OpenInference instrumentation** of the AI Linux Ollama server and agents before agent traces appear. Grafana has a provisioned Prometheus datasource but no custom AI Linux dashboard yet. node-exporter collects host metrics, not full root-shell or kernel modification telemetry.

## Production hardening
Pin reviewed image digests rather than `latest`, configure Grafana admin credentials via secrets, add authentication to Phoenix before remote exposure, define retention and backup policies, audit container mount permissions, and test the stack on Ubuntu. No agent authentication tokens should be committed.

Status: configuration files committed only; no claim of deployment, actual metrics, or end-to-end integration.
