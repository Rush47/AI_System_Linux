const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const { z } = require('zod');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');

function readOsRelease() {
  const entries = fs.readFileSync('/etc/os-release', 'utf8')
    .split('\n')
    .map((line) => line.match(/^(ID|NAME|PRETTY_NAME|VERSION_ID)=(.*)$/))
    .filter(Boolean)
    .map(([, key, value]) => `${key}=${value.replace(/^"|"$/g, '')}`);

  return entries.join('\n') || 'No distribution information available.';
}

function systemResources() {
  const gib = (bytes) => `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  return [
    `Architecture: ${os.arch()}`,
    `Kernel: ${os.release()}`,
    `CPU cores: ${os.cpus().length}`,
    `Memory total: ${gib(os.totalmem())}`,
    `Memory free: ${gib(os.freemem())}`,
    `Uptime: ${Math.floor(os.uptime() / 60)} minutes`,
    `Load average (1/5/15 min): ${os.loadavg().map((value) => value.toFixed(2)).join('/')}`,
  ].join('\n');
}

function rootFilesystem() {
  const { bavail, bsize, blocks } = fs.statfsSync('/');
  const gib = (bytes) => `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  return [
    'Filesystem: /',
    `Capacity: ${gib(blocks * bsize)}`,
    `Available: ${gib(bavail * bsize)}`,
  ].join('\n');
}

function createMcpServer() {
  const server = new McpServer({ name: 'ubuntu-system-info', version: '1.0.0' });

  server.registerTool(
    'get_linux_distribution',
    {
      description: 'Read the Linux distribution name and version from /etc/os-release.',
      inputSchema: {},
    },
    async () => ({ content: [{ type: 'text', text: readOsRelease() }] }),
  );

  server.registerTool(
    'get_system_resources',
    {
      description: 'Read Linux kernel, CPU, memory, uptime, and load information.',
      inputSchema: {},
    },
    async () => ({ content: [{ type: 'text', text: systemResources() }] }),
  );

  server.registerTool(
    'get_root_filesystem_usage',
    {
      description: 'Read capacity and available space for the root filesystem.',
      inputSchema: {},
    },
    async () => ({ content: [{ type: 'text', text: rootFilesystem() }] }),
  );


  // File access is intentionally limited to a dedicated persistent workspace.
  const workspace = path.resolve(process.env.MCP_WORKSPACE || '/workspace');
  const resolveFile = (relative) => {
    if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw new Error('Invalid relative path');
    const target = path.resolve(workspace, relative);
    if (target !== workspace && !target.startsWith(workspace + path.sep)) throw new Error('Path outside workspace');
    const parent = fs.realpathSync(path.dirname(target));
    if (parent !== workspace && !parent.startsWith(workspace + path.sep)) throw new Error('Symlink escape rejected');
    return target;
  };
  const result = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data) }] });
  server.registerTool('workspace_list', {
    description: 'List files in the dedicated MCP workspace',
    inputSchema: { directory: z.string().default('.') },
  }, async ({ directory }) => {
    const target = resolveFile(path.join(directory, '.'));
    return result(fs.readdirSync(target, { withFileTypes: true }).map(e => ({ name: e.name, type: e.isDirectory() ? 'directory' : 'file' })));
  });
  server.registerTool('workspace_read', {
    description: 'Read a UTF-8 file in the dedicated workspace (up to 256 KiB)',
    inputSchema: { file: z.string().min(1) },
  }, async ({ file }) => {
    const target = resolveFile(file);
    if (!fs.statSync(target).isFile() || fs.statSync(target).size > 262144) throw new Error('Not a readable small file');
    return result({ file, content: fs.readFileSync(target, 'utf8') });
  });
  server.registerTool('workspace_write', {
    description: 'Create or replace a workspace text file. Requires configured MCP_WRITE_TOKEN on the server.',
    inputSchema: { file: z.string().min(1), content: z.string().max(262144), write_token: z.string().min(1) },
  }, async ({ file, content, write_token }) => {
    const expected = process.env.MCP_WRITE_TOKEN;
    if (!expected || !crypto.timingSafeEqual(Buffer.from(crypto.createHash('sha256').update(write_token).digest()), Buffer.from(crypto.createHash('sha256').update(expected).digest()))) throw new Error('Write authorization failed');
    const target = resolveFile(file);
    if (fs.existsSync(target) && !fs.statSync(target).isFile()) throw new Error('Not a regular file');
    fs.writeFileSync(target, content, { encoding: 'utf8', flag: 'w', mode: 0o600 });
    return result({ saved: true, file, bytes: Buffer.byteLength(content) });
  });
  server.registerTool('list_agents', {
    description: 'List configured original agent bridge URLs; does not claim agents are online',
    inputSchema: {},
  }, async () => result(['aria','alex','astyria','aurelius'].map(id => ({ id, configured: Boolean(process.env['AGENT_' + id.toUpperCase() + '_URL']), online: 'unverified' }))));
  server.registerTool('agent_send_message', {
    description: 'Forward a message to an explicitly configured original agent bridge; no synthetic agent fallback',
    inputSchema: { agent_id: z.enum(['aria','alex','astyria','aurelius']), message: z.string().min(1).max(16000), write_token: z.string().min(1) },
  }, async ({ agent_id, message, write_token }) => {
    const expected = process.env.MCP_WRITE_TOKEN;
    if (!expected || crypto.createHash('sha256').update(write_token).digest('hex') !== crypto.createHash('sha256').update(expected).digest('hex')) throw new Error('Authorization failed');
    const endpoint = process.env['AGENT_' + agent_id.toUpperCase() + '_URL'];
    if (!endpoint) return result({ agent_id, delivered: false, reason: 'Original agent bridge not configured' });
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' && !(url.hostname === '127.0.0.1' || url.hostname === 'localhost')) throw new Error('HTTPS required for remote agent');
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(process.env.AGENT_BRIDGE_TOKEN ? { authorization: 'Bearer ' + process.env.AGENT_BRIDGE_TOKEN } : {}) }, body: JSON.stringify({ agent_id, message }), signal: AbortSignal.timeout(10000), redirect: 'error' });
    const body = (await response.text()).slice(0, 16000);
    return result({ agent_id, accepted: response.ok, http_status: response.status, response: body, execution_confirmed: false });
  });

  return server;
}

const app = http.createServer(async (req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (req.method === 'GET' && pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  if (pathname !== '/mcp' || !['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.writeHead(404);
    res.end();
    return;
  }

  try {
    console.log(`[ubuntu-system-info] ${req.method} accept=${req.headers.accept ?? '<missing>'}`);
    let body;
    if (req.method === 'POST') {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 1024 * 1024) {
          res.writeHead(413);
          res.end();
          return;
        }
        chunks.push(chunk);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }

    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    transport.onerror = (error) => {
      console.error('[ubuntu-system-info] MCP transport error', error);
    };
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    console.error('[ubuntu-system-info] MCP request failed', error);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end();
    }
  }
});
async function main() {
  app.listen(8000, '0.0.0.0', () => {
    console.log('Ubuntu system info MCP listening on port 8000');
  });
}

main().catch((error) => {
  console.error('[ubuntu-system-info] failed to start MCP server', error);
  process.exitCode = 1;
});
