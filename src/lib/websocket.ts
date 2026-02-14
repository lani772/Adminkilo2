import { WebSocket, WebSocketServer } from 'ws';
import type { WebSocketEvent, WebSocketEventType } from '@/types';
import { verifyToken, type JWTPayload } from './auth';

// ============================================================================
// WEBSOCKET CONNECTION MANAGER
// ============================================================================

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  username?: string;
  role?: string;
  isAlive?: boolean;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  initialize(server: any) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
      console.log('🔌 New WebSocket connection attempt');

      // Extract token from query string or headers
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token') || req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        console.log('❌ WebSocket connection rejected: No token provided');
        ws.close(1008, 'Authentication required');
        return;
      }

      // Verify token
      const payload = verifyToken(token);
      if (!payload) {
        console.log('❌ WebSocket connection rejected: Invalid token');
        ws.close(1008, 'Invalid token');
        return;
      }

      // Attach user info to WebSocket
      ws.userId = payload.userId;
      ws.username = payload.username;
      ws.role = payload.role;
      ws.isAlive = true;

      // Add to clients map
      if (!this.clients.has(payload.userId)) {
        this.clients.set(payload.userId, new Set());
      }
      this.clients.get(payload.userId)!.add(ws);

      console.log(`✅ WebSocket authenticated: ${payload.username} (${payload.role})`);

      // Send welcome message
      this.sendToClient(ws, {
        type: 'system:config_updated',
        timestamp: new Date().toISOString(),
        data: { message: 'Connected to Admin Panel WebSocket' },
      });

      // Handle pong responses for heartbeat
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Handle messages from client
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        console.log(`🔌 WebSocket disconnected: ${ws.username}`);
        if (ws.userId) {
          const userClients = this.clients.get(ws.userId);
          if (userClients) {
            userClients.delete(ws);
            if (userClients.size === 0) {
              this.clients.delete(ws.userId);
            }
          }
        }
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
      });
    });

    // Heartbeat to detect broken connections
    const heartbeatInterval = setInterval(() => {
      this.wss?.clients.forEach((ws: WebSocket) => {
        const client = ws as AuthenticatedWebSocket;
        if (client.isAlive === false) {
          console.log(`💔 Terminating dead connection: ${client.username}`);
          return client.terminate();
        }
        client.isAlive = false;
        client.ping();
      });
    }, 30000); // Every 30 seconds

    this.wss.on('close', () => {
      clearInterval(heartbeatInterval);
    });

    console.log('✅ WebSocket server initialized');
  }

  private handleClientMessage(ws: AuthenticatedWebSocket, data: any) {
    // Handle client-to-server messages (e.g., subscribe to specific resources)
    if (data.type === 'subscribe') {
      console.log(`📡 ${ws.username} subscribed to: ${data.resource}`);
      // Store subscription info if needed
    }
  }

  private sendToClient(ws: AuthenticatedWebSocket, event: WebSocketEvent) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  }

  // ============================================================================
  // BROADCASTING METHODS
  // ============================================================================

  /**
   * Broadcast event to a specific user
   */
  broadcastToUser(userId: string, event: WebSocketEvent) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.forEach((ws) => {
        this.sendToClient(ws, event);
      });
      console.log(`📤 Broadcasted ${event.type} to user ${userId}`);
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcastToAll(event: WebSocketEvent) {
    this.clients.forEach((userClients) => {
      userClients.forEach((ws) => {
        this.sendToClient(ws, event);
      });
    });
    console.log(`📤 Broadcasted ${event.type} to all clients (${this.clients.size} users)`);
  }

  /**
   * Broadcast event to all admins
   */
  broadcastToAdmins(event: WebSocketEvent) {
    this.clients.forEach((userClients) => {
      userClients.forEach((ws) => {
        if (ws.role === 'admin' || ws.role === 'super_admin') {
          this.sendToClient(ws, event);
        }
      });
    });
    console.log(`📤 Broadcasted ${event.type} to admins`);
  }

  /**
   * Broadcast event to users with access to a specific resource
   */
  broadcastToResourceUsers(userIds: string[], event: WebSocketEvent) {
    userIds.forEach((userId) => {
      this.broadcastToUser(userId, event);
    });
  }

  /**
   * Get count of connected clients
   */
  getConnectedCount(): number {
    return this.clients.size;
  }

  /**
   * Get list of connected user IDs
   */
  getConnectedUserIds(): string[] {
    return Array.from(this.clients.keys());
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();

// ============================================================================
// EVENT HELPER FUNCTIONS
// ============================================================================

export function createEvent<T = any>(
  type: WebSocketEventType,
  data: T,
  userId?: string
): WebSocketEvent<T> {
  return {
    type,
    timestamp: new Date().toISOString(),
    data,
    userId,
  };
}

// Device events
export function broadcastDeviceOnline(controllerId: string, controllerName: string) {
  wsManager.broadcastToAll(
    createEvent('device:online', { controllerId, controllerName })
  );
}

export function broadcastDeviceOffline(controllerId: string, controllerName: string) {
  wsManager.broadcastToAll(
    createEvent('device:offline', { controllerId, controllerName })
  );
}

export function broadcastDeviceError(controllerId: string, error: string) {
  wsManager.broadcastToAdmins(
    createEvent('device:error', { controllerId, error })
  );
}

// Lamp events
export function broadcastLampToggled(lampId: string, lampName: string, isOn: boolean, userId: string) {
  wsManager.broadcastToAll(
    createEvent('lamp:toggled', { lampId, lampName, isOn }, userId)
  );
}

export function broadcastLampBrightnessChanged(lampId: string, brightness: number) {
  wsManager.broadcastToAll(
    createEvent('lamp:brightness_changed', { lampId, brightness })
  );
}

// Permission events
export function broadcastPermissionGranted(userId: string, resourceType: string, resourceId: string, accessLevel: string) {
  wsManager.broadcastToUser(
    userId,
    createEvent('permission:granted', { resourceType, resourceId, accessLevel }, userId)
  );
}

export function broadcastPermissionRevoked(userId: string, permissionId: string) {
  wsManager.broadcastToUser(
    userId,
    createEvent('permission:revoked', { permissionId }, userId)
  );
}

// User events
export function broadcastUserCreated(user: any) {
  wsManager.broadcastToAdmins(
    createEvent('user:created', { user })
  );
}

export function broadcastUserUpdated(userId: string, changes: any) {
  wsManager.broadcastToAdmins(
    createEvent('user:updated', { userId, changes })
  );
  wsManager.broadcastToUser(
    userId,
    createEvent('user:updated', { userId, changes }, userId)
  );
}

export function broadcastUserDeleted(userId: string) {
  wsManager.broadcastToAdmins(
    createEvent('user:deleted', { userId })
  );
}

// Alert events
export function broadcastAlertCreated(alert: any) {
  wsManager.broadcastToAdmins(
    createEvent('alert:created', { alert })
  );
}

export function broadcastAlertResolved(alertId: string) {
  wsManager.broadcastToAdmins(
    createEvent('alert:resolved', { alertId })
  );
}

// System events
export function broadcastMaintenanceMode(enabled: boolean) {
  wsManager.broadcastToAll(
    createEvent('system:maintenance_mode', { enabled })
  );
}

export function broadcastConfigUpdated(changes: any) {
  wsManager.broadcastToAdmins(
    createEvent('system:config_updated', { changes })
  );
}

export default wsManager;
