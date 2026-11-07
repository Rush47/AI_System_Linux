# AI_System_Linux — Rush47

Target: **AILinux 26.04 AMD64** with optional **Agent Zero + LibreChat** and the **original** Aria, Alex, Astyria and Aurelius agents from mmitek515-netizen.

## Current status
- AILinux ISO is **not** committed to Git (4.89 GiB). Get the current direct ISO URL from https://ailinux.me/ and download with checksum verification:
  `bash scripts/download-ailinux.sh 'https://DIRECT-OFFICIAL-ISO-URL'`
- Verified target ISO: `ailinux-26.04-amd64-20261013T144048Z.iso`
- SHA-256: `de744684375ccbc15d6be45acf567cb8549475e9c57cf812c1aed47a8da4b2c7`
- Agent Zero upstream: https://github.com/frdel/agent-zero
- LibreChat upstream: https://github.com/danny-avila/LibreChat
- Deployment of those services is **not yet implemented**; the included Compose file is a placeholder, not an installer.
- Migration of original agents is **not yet performed**. See [docs/AGENTS.md](docs/AGENTS.md).
- No running machine, Codespace, or root access has been provisioned by this repository.

## Intended next steps
1. Download and verify the ISO; install or test it on compatible AMD64 hardware/VM.
2. Set up Docker, Agent Zero and LibreChat using vetted upstream installation instructions.
3. Inspect GitHub account/repository permissions for the original agents and connect their existing services, without cloning their identities.
4. Configure model endpoints, secrets, memory storage and agent permissions. Never commit passwords or API keys.
5. Verify live chat, terminal actions, persistence and end-to-end communication.

System administrator controls root. Agent elevation should be explicit, audited and configurable.
