import { timingSafeEqual } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const agentIds = ['aria', 'alex', 'astyria', 'aurelius'];

function matchesToken(received, expected) {
  if (typeof received !== 'string' || typeof expected !== 'string' || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function textResult(value, isError = false) {
  return { content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], ...(isError ? { isError: true } : {}) };
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error('MCP request exceeds 1 MiB');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function handleMcpRequest(req, res, {
  authToken,
  terminalToken,
  systemStatus,
  listAgents,
  sendMessage,
  createTask,
  getTaskStatus,
  getLogs,
  terminalExecute,
}) {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (path !== '/mcp' || !['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.writeHead(404);
    res.end();
    return;
  }

  if (authToken && terminalToken && authToken === terminalToken) {
    res.writeHead(503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'MCP_AUTH_TOKEN and MCP_TERMINAL_TOKEN must be different' }));
    return;
  }

  const authorization = req.headers.authorization || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const role = matchesToken(bearer, terminalToken) ? 'terminal' : matchesToken(bearer, authToken) ? 'operator' : null;
  if (!role) {
    const configured = Boolean(authToken || terminalToken);
    res.writeHead(configured ? 401 : 503, {
      'content-type': 'application/json',
      'www-authenticate': 'Bearer realm="AI Linux MCP"',
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify({ error: configured ? 'Bearer token required' : 'MCP bearer tokens are not configured' }));
    return;
  }

  if (req.method === 'POST' && !req.headers['content-type']?.includes('application/json')) {
    res.writeHead(415);
    res.end(JSON.stringify({ error: 'Expected application/json' }));
    return;
  }

  let body;
  if (req.method === 'POST') {
    try { body = await readBody(req); }
    catch (error) {
      res.writeHead(error.message.includes('1 MiB') ? 413 : 400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: error.message === 'Unexpected end of JSON input' ? 'Invalid JSON body' : error.message }));
      return;
    }
  }

  const mcp = new McpServer({ name: 'ai-linux-control-center', version: '1.0.0' });
  const register = (name, config, handler) => mcp.registerTool(name, config, async args => {
    try { return textResult(await handler(args)); }
    catch (error) { return textResult({ error: String(error.message || error).slice(0, 500) }, true); }
  });

  register('system_status', {
    description: 'Read live AI Linux service, model, integration, and MCP status. Values come from the running Control Center.',
    inputSchema: {},
  }, systemStatus);

  register('list_agents', {
    description: 'List the four original agents. Online requires a recent authenticated agent callback; a profile or configured URL alone is not online.',
    inputSchema: {},
  }, listAgents);

  register('get_task_status', {
    description: 'Read actual delivery/callback state for an Agent Bridge task. Endpoint acceptance is not proof of agent execution.',
    inputSchema: { task_id: z.string().min(1).max(160) },
  }, ({ task_id }) => getTaskStatus(task_id));

  register('get_logs', {
    description: 'Read the most recent redacted Control Center log lines only.',
    inputSchema: { lines: z.number().int().min(1).max(100).optional() },
  }, ({ lines }) => getLogs(lines));

  if (role === 'operator') {
    register('send_message', {
      description: 'Send a real message to one configured original agent. Returns unconfigured or delivery status when no endpoint is available.',
      inputSchema: { agent: z.enum(agentIds), message: z.string().min(1).max(4000) },
    }, ({ agent, message }) => sendMessage(agent, message));

    register('create_task', {
      description: 'Dispatch a real background task to one configured original agent. Accepted-by-endpoint does not mean completed; use get_task_status for callbacks.',
      inputSchema: { agent: z.enum(agentIds), task: z.string().min(1).max(4000) },
    }, ({ agent, task }) => createTask(agent, task));
  }

  if (role === 'terminal') {
    register('terminal_execute', {
      description: 'Execute one explicitly allowlisted read-only diagnostic in the Codespaces container. Arbitrary shell, writes, sudo, and host-root are not available.',
      inputSchema: { operation: z.enum(['kernel', 'processes', 'disk', 'memory', 'workspace', 'containers']) },
    }, ({ operation }) => terminalExecute(operation));
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  transport.onerror = error => console.error('[ai-linux-mcp] transport error:', error.message);
  try {
    await mcp.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (error) {
    console.error('[ai-linux-mcp] request failed:', error.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'MCP request failed' }));
    }
  }
}