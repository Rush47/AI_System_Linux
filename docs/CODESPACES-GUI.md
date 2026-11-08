# AI Linux GUI in GitHub Codespaces

Open Codespaces on the feature branch. Ports 3080 (LibreChat), 8000 (MCP), and 5173 (future Vite GUI) are forwarded.

## Start existing services
1. Copy the required environment variables to a private `.env` (never commit tokens).
2. Run `docker compose up --build -d`.
3. Open the forwarded 3080 port to use LibreChat.
4. Port 8000 is an internal MCP service; do not make it public without an authenticated gateway.

## GUI development
The repository currently does not contain a custom React GUI. Build it as a separate `gui/` application, use port 5173, and keep the existing LibreChat stack intact. Vite can provide hot reload once installed.

## MCP changes
The proposed MCP tools provide read/write within the dedicated `/workspace` volume. They do not yet edit the repository working tree in Codespaces. A separate, authenticated developer bridge or a controlled workspace mount is required for editing GUI source via MCP. Original agent URLs and write token must be configured. No agent connection is assumed to be live.

Do not expose unrestricted shell/root operations or credentials through public forwarded ports.
