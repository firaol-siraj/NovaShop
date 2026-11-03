import logger from '../utils/logger.js';

// Connected SSE clients: Map<clientId, { res, user, connectedAt }>
const clients = new Map();
let nextClientId = 1;
let heartbeatInterval = null;

/**
 * Start keepalive heartbeat ping every 25 seconds to keep proxies & browsers alive
 */
function ensureHeartbeat() {
  if (heartbeatInterval) return;
  heartbeatInterval = setInterval(() => {
    for (const [clientId, client] of clients.entries()) {
      try {
        client.res.write(': ping\n\n');
      } catch (err) {
        logger.debug(`[SupportSSE] Failed ping to client ${clientId}, removing: ${err.message}`);
        clients.delete(clientId);
      }
    }
    if (clients.size === 0) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  }, 25000);
}

/**
 * Register a new SSE connection for an authenticated admin or staff member
 */
export function registerSSEClient(req, res, user) {
  const clientId = nextClientId++;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable proxy buffering for Nginx
  });

  // Initial connection handshake
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`);

  clients.set(clientId, { res, user, connectedAt: new Date() });
  logger.info(`[SupportSSE] Client ${clientId} connected (${user?.email || 'admin'}). Total active clients: ${clients.size}`);

  ensureHeartbeat();

  req.on('close', () => {
    clients.delete(clientId);
    logger.debug(`[SupportSSE] Client ${clientId} disconnected. Remaining active: ${clients.size}`);
  });

  return clientId;
}

/**
 * Broadcast an event to all connected admin clients (or matching filter)
 * @param {string} eventType - e.g. 'conversation.created', 'message.created', 'stats.updated'
 * @param {object} payload - data payload
 * @param {function} [filterFn] - optional filter (client) => boolean
 */
export function broadcastSupportEvent(eventType, payload, filterFn = null) {
  if (clients.size === 0) return;

  const dataStr = JSON.stringify(payload || {});
  const sseMessage = `event: ${eventType}\ndata: ${dataStr}\n\n`;

  let sentCount = 0;
  for (const [clientId, client] of clients.entries()) {
    if (filterFn && !filterFn(client)) continue;

    try {
      client.res.write(sseMessage);
      sentCount++;
    } catch (err) {
      logger.warn(`[SupportSSE] Error writing to client ${clientId}: ${err.message}`);
      clients.delete(clientId);
    }
  }

  logger.debug(`[SupportSSE] Broadcasted '${eventType}' to ${sentCount}/${clients.size} clients`);
}

/**
 * Get active SSE client count
 */
export function getActiveSSECount() {
  return clients.size;
}
