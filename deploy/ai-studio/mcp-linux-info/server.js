const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
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
