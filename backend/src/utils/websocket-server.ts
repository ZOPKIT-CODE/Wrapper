/**
 * WebSocket Server for Real-time Notifications
 * Replaces polling with WebSocket connections for better performance
 */

import { WebSocketServer as WSServer, WebSocket } from 'ws';
import { parse } from 'url';
import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import Logger from './logger.js';

let wss: WSServer | null = null;
const clientConnections = new Map<string, Set<WebSocket>>(); // userId -> Set of WebSocket connections
const tenantUserMap = new Map<string, Set<string>>(); // tenantId -> Set of userIds
const userTenantMap = new Map<string, string>(); // userId -> tenantId

// Module-level JWKS set — cached once to avoid re-fetching on every connection.
// AWS Cognito issuer: https://cognito-idp.<region>.amazonaws.com/<userPoolId>
const cognitoIssuerUrl = `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`;
const wsJwks = createRemoteJWKSet(
  new URL(`${cognitoIssuerUrl}/.well-known/jwks.json`),
  { cacheMaxAge: 6 * 60 * 60 * 1000 } // 6 hours
);

/**
 * Initialize WebSocket server
 */
export function initWebSocketServer(server: Server): WSServer {
  if (wss) {
    return wss;
  }

  wss = new WSServer({
    server,
    path: '/ws',
    perMessageDeflate: false // Disable compression for lower latency
  });

  wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
    const url = parse(request.url ?? '', true);
    const userId = url.query?.userId as string | undefined;
    const tenantId = url.query?.tenantId as string | undefined;
    const token = url.query?.token as string | undefined;

    if (!userId || !tenantId || !token) {
      Logger.log('warning', 'websocket', 'connection-rejected', 'WebSocket connection rejected: missing parameters');
      ws.close(1008, 'Missing required parameters');
      return;
    }

    // Validate JWT token using Cognito's JWKS endpoint
    try {
      const { payload } = await jwtVerify(token, wsJwks, {
        issuer: cognitoIssuerUrl,
      });

      // Verify token is not expired (jwtVerify handles this, but be explicit)
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp !== undefined && payload.exp < now) {
        Logger.log('warning', 'websocket', 'connection-rejected', `WebSocket connection rejected: token expired for ${userId}`, { userId });
        ws.close(1008, 'Token expired');
        return;
      }

      // Verify the token's subject matches the claimed userId
      const tokenSub = payload.sub;
      if (!tokenSub || tokenSub !== userId) {
        Logger.log('warning', 'websocket', 'connection-rejected', `WebSocket connection rejected: userId mismatch (token sub: ${tokenSub}, param: ${userId})`, { tokenSub, userId });
        ws.close(1008, 'Token userId mismatch');
        return;
      }
    } catch (err) {
      const error = err as Error;
      Logger.log('warning', 'websocket', 'connection-rejected', `WebSocket connection rejected: invalid token — ${error.message}`, { error: error.message });
      ws.close(1008, 'Invalid or expired token');
      return;
    }

    Logger.log('info', 'websocket', 'connected', `WebSocket connected: ${userId} (tenant: ${tenantId})`, { userId, tenantId });

    // Store connection
    if (!clientConnections.has(userId)) {
      clientConnections.set(userId, new Set());
    }
    clientConnections.get(userId)!.add(ws);

    // Maintain tenant-to-users mapping
    if (!tenantUserMap.has(tenantId)) {
      tenantUserMap.set(tenantId, new Set());
    }
    tenantUserMap.get(tenantId)!.add(userId);
    userTenantMap.set(userId, tenantId);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'WebSocket connection established',
      timestamp: new Date().toISOString()
    }));

    // Handle messages
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        handleWebSocketMessage(ws, userId, tenantId, data);
      } catch (error) {
        const err = error as Error;
        Logger.log('error', 'websocket', 'message-error', 'WebSocket message error', { error: err.message, stack: err.stack });
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });

    // Handle disconnect
    ws.on('close', () => {
      Logger.log('info', 'websocket', 'disconnected', `WebSocket disconnected: ${userId}`, { userId });
      const connections = clientConnections.get(userId);
      if (connections) {
        connections.delete(ws);
        if (connections.size === 0) {
          clientConnections.delete(userId);
          
          // Clean up tenant mapping
          const userTenant = userTenantMap.get(userId);
          if (userTenant) {
            const tenantUsers = tenantUserMap.get(userTenant);
            if (tenantUsers) {
              tenantUsers.delete(userId);
              if (tenantUsers.size === 0) {
                tenantUserMap.delete(userTenant);
              }
            }
            userTenantMap.delete(userId);
          }
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      const err = error as Error;
      Logger.log('error', 'websocket', 'connection-error', `WebSocket error for ${userId}`, { userId, error: err.message, stack: err.stack });
    });

    // Send ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    ws.on('close', () => {
      clearInterval(pingInterval);
    });
  });

  Logger.log('info', 'websocket', 'server-initialized', 'WebSocket server initialized');
  return wss;
}

/**
 * Handle incoming WebSocket messages
 */
function handleWebSocketMessage(ws: WebSocket, userId: string, tenantId: string, data: { type: string; channels?: unknown }): void {
  switch (data.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;
    
    case 'subscribe':
      // Subscribe to specific notification types
      Logger.log('info', 'websocket', 'subscribe', `User ${userId} subscribed`, { userId, channels: data.channels });
      break;

    default:
      Logger.log('info', 'websocket', 'unknown-message', `Unknown message type: ${data.type}`, { userId, type: data.type });
  }
}

/**
 * Broadcast notification to user
 */
export function sendNotificationToUser(userId: string, notification: Record<string, unknown>): boolean {
  const connections = clientConnections.get(userId);
  if (!connections || connections.size === 0) {
    return false;
  }

  const message = JSON.stringify({
    type: 'notification',
    data: notification,
    timestamp: new Date().toISOString()
  });

  let sent = false;
  connections.forEach((ws: WebSocket) => {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(message);
        sent = true;
      } catch (error) {
        const err = error as Error;
        Logger.log('error', 'websocket', 'send-notification-failed', `Failed to send notification to ${userId}`, { userId, error: err.message, stack: err.stack });
      }
    }
  });

  return sent;
}

/**
 * Broadcast notification to all users in a tenant
 */
export function broadcastToTenant(tenantId: string, notification: Record<string, unknown>): { sent: number; total: number } {
  const userIds = tenantUserMap.get(tenantId);
  if (!userIds || userIds.size === 0) {
    Logger.log('info', 'websocket', 'broadcast-skip', `No active connections for tenant ${tenantId}`, { tenantId });
    return { sent: 0, total: 0 };
  }

  const message = JSON.stringify({
    type: 'notification',
    data: notification,
    timestamp: new Date().toISOString()
  });

  let sentCount = 0;
  const totalUsers = userIds.size;

  userIds.forEach((userId: string) => {
    const connections = clientConnections.get(userId);
    if (connections && connections.size > 0) {
      connections.forEach((ws: WebSocket) => {
        if (ws.readyState === ws.OPEN) {
          try {
            ws.send(message);
            sentCount++;
          } catch (error) {
            const err = error as Error;
            Logger.log('error', 'websocket', 'broadcast-send-failed', `Failed to send notification to ${userId}`, { userId, tenantId, error: err.message, stack: err.stack });
          }
        }
      });
    }
  });

  Logger.log('info', 'websocket', 'broadcast-tenant', `Broadcasted to ${sentCount} connections across ${totalUsers} users in tenant ${tenantId}`, { tenantId, sent: sentCount, totalUsers });
  return { sent: sentCount, total: totalUsers };
}

/**
 * Broadcast notification to multiple tenants
 */
export function broadcastToTenants(tenantIds: string[], notification: Record<string, unknown>): {
  results: Array<{ tenantId: string; sent: number; total: number }>;
  summary: { totalSent: number; totalUsers: number; totalTenants: number };
} {
  const results = tenantIds.map((tenantId: string) => ({
    tenantId,
    ...broadcastToTenant(tenantId, notification)
  }));

  const totalSent = results.reduce((sum: number, r: { sent: number; total: number }) => sum + r.sent, 0);
  const totalUsers = results.reduce((sum: number, r: { sent: number; total: number }) => sum + r.total, 0);

  Logger.log('info', 'websocket', 'broadcast-tenants', `Bulk broadcasted to ${totalSent} connections across ${totalUsers} users in ${tenantIds.length} tenants`, { tenantCount: tenantIds.length, totalSent, totalUsers });
  return {
    results,
    summary: {
      totalSent,
      totalUsers,
      totalTenants: tenantIds.length
    }
  };
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer(): WSServer | null {
  return wss;
}

/**
 * Get active connection count
 */
export function getConnectionCount(): number {
  return clientConnections.size;
}

/**
 * Get tenant user count
 */
export function getTenantUserCount(tenantId: string): number {
  const userIds = tenantUserMap.get(tenantId);
  return userIds ? userIds.size : 0;
}

/**
 * Get all active tenants
 */
export function getActiveTenants(): string[] {
  return Array.from(tenantUserMap.keys());
}

export default {
  initWebSocketServer,
  sendNotificationToUser,
  broadcastToTenant,
  broadcastToTenants,
  getWebSocketServer,
  getConnectionCount,
  getTenantUserCount,
  getActiveTenants
};

