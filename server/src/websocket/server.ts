import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'node:http';
import { URL } from 'node:url';
import { Room, ConnectedClient } from './room.js';
import { PubSubBroker } from '../pubsub/broker.js';
import { StorageEngine } from '../persistence/storage.js';
import { SyncMessage } from '../sync/types.js';

export interface ServerOptions {
  port: number;
  dataDir: string;
  redisUrl?: string;
}

export class CollabServer {
  private server: http.Server;
  private wss: WebSocketServer;
  private rooms: Map<string, Room> = new Map();
  private broker: PubSubBroker;
  private storage: StorageEngine;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private totalConnections: number = 0;
  private totalMessages: number = 0;

  constructor(opts: ServerOptions) {
    this.broker = new PubSubBroker(opts.redisUrl);
    this.storage = new StorageEngine(opts.dataDir, (roomId) => {
      const room = this.rooms.get(roomId);
      return room ? room.crdt.getAll() : [];
    });

    this.server = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    this.wss = new WebSocketServer({ noServer: true });

    this.server.on('upgrade', (request, socket, head) => {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request);
      });
    });

    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.startHeartbeat();
  }

  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', time: Date.now() }));
      return;
    }

    if (req.url === '/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          activeRooms: this.rooms.size,
          activeClients: this.wss.clients.size,
          totalConnections: this.totalConnections,
          totalMessages: this.totalMessages,
          redisCluster: this.broker.hasRedis(),
          serverId: this.broker.getServerId(),
        })
      );
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  private async getOrCreateRoom(roomId: string): Promise<Room> {
    let room = this.rooms.get(roomId);
    if (!room) {
      const snapshot = await this.storage.loadRoom(roomId);
      room = new Room(roomId, snapshot ? snapshot.elements : [], this.broker, this.storage);
      this.rooms.set(roomId, room);
    }
    return room;
  }

  private async handleConnection(ws: WebSocket, req: http.IncomingMessage) {
    this.totalConnections++;
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host}`);
    const roomId = parsedUrl.searchParams.get('room') || 'default-room';
    const userName = parsedUrl.searchParams.get('user') || `User-${Math.floor(Math.random() * 1000)}`;
    const clientId = parsedUrl.searchParams.get('clientId') || `c-${Math.random().toString(36).substring(2, 9)}`;

    // Generate random avatar color
    const colors = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const client: ConnectedClient = {
      id: clientId,
      userName,
      color,
      ws,
      lastPing: Date.now(),
    };

    const room = await this.getOrCreateRoom(roomId);
    room.addClient(client);

    ws.on('message', (data: Buffer | string) => {
      this.totalMessages++;
      try {
        const msg: SyncMessage = JSON.parse(data.toString());
        room.handleClientMessage(clientId, msg);
      } catch (err) {
        console.error(`[CollabServer] Error handling message: ${err}`);
      }
    });

    ws.on('close', () => {
      room.removeClient(clientId);
      if (room.clientCount() === 0) {
        // Debounce room cleanup
        const timer = setTimeout(() => {
          if (room.clientCount() === 0) {
            this.rooms.delete(roomId);
          }
        }, 30000);
        timer.unref();
      }
    });

    ws.on('error', (err) => {
      console.error(`[CollabServer] Client socket error (${clientId}): ${err}`);
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const client of this.wss.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        }
      }
    }, 20000);
    this.heartbeatInterval.unref();
  }

  public listen(port: number): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(`[CollabServer] Listening on ws://0.0.0.0:${port}`);
        resolve();
      });
    });
  }

  public async close(): Promise<void> {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    for (const ws of this.wss.clients) {
      ws.close();
    }
    this.wss.close();
    await this.storage.close();
    await this.broker.close();
    if ('closeAllConnections' in this.server) {
      (this.server as any).closeAllConnections();
    }
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }
}
