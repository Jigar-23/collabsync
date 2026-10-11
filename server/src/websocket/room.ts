import { WebSocket } from 'ws';
import { LWWElementRegister } from '../sync/crdt.js';
import { CanvasElement, SyncMessage, UserPresence } from '../sync/types.js';
import { PubSubBroker } from '../pubsub/broker.js';
import { StorageEngine } from '../persistence/storage.js';

export interface ConnectedClient {
  id: string;
  userName: string;
  color: string;
  ws: WebSocket;
  lastPing: number;
}

export class Room {
  public id: string;
  public crdt: LWWElementRegister;
  private clients: Map<string, ConnectedClient> = new Map();
  private broker: PubSubBroker;
  private storage: StorageEngine;
  private channel: string;

  constructor(id: string, initialElements: CanvasElement[], broker: PubSubBroker, storage: StorageEngine) {
    this.id = id;
    this.crdt = new LWWElementRegister(initialElements);
    this.broker = broker;
    this.storage = storage;
    this.channel = `room:${id}:events`;

    // Listen for events from other server instances in the cluster
    this.broker.subscribe(this.channel, (_ch, message) => {
      this.handleClusterMessage(message);
    });
  }

  public addClient(client: ConnectedClient) {
    this.clients.set(client.id, client);

    // 1. Send INIT_STATE to the joining client
    const initState: SyncMessage = {
      type: 'INIT_STATE',
      roomId: this.id,
      clientId: client.id,
      lamport: this.crdt.getLamport(),
      timestamp: Date.now(),
      payload: {
        elements: this.crdt.getAllActive(),
        users: this.getPresenceList(),
      },
    };
    this.sendToClient(client, initState);

    // 2. Broadcast USER_JOIN to other clients in room
    const joinMsg: SyncMessage = {
      type: 'USER_JOIN',
      roomId: this.id,
      clientId: client.id,
      lamport: this.crdt.tick(),
      timestamp: Date.now(),
      payload: {
        userName: client.userName,
        color: client.color,
      },
    };
    this.broadcast(joinMsg, client.id);
  }

  public removeClient(clientId: string) {
    if (!this.clients.has(clientId)) return;

    this.clients.delete(clientId);

    const leaveMsg: SyncMessage = {
      type: 'USER_LEAVE',
      roomId: this.id,
      clientId,
      lamport: this.crdt.tick(),
      timestamp: Date.now(),
    };
    this.broadcast(leaveMsg);
  }

  public handleClientMessage(clientId: string, msg: SyncMessage) {
    switch (msg.type) {
      case 'ELEMENT_UPSERT':
      case 'ELEMENT_DELETE': {
        const element: CanvasElement = msg.payload;
        const merged = this.crdt.mergeElement(element);
        if (merged) {
          this.storage.markDirty(this.id);
          // Broadcast to local room peers
          this.broadcast(msg, clientId);
          // Publish to Redis cluster
          this.broker.publish(this.channel, msg);
        }
        break;
      }

      case 'CURSOR_MOVE': {
        // Broadcast ephemeral cursor data
        this.broadcast(msg, clientId);
        this.broker.publish(this.channel, msg);
        break;
      }

      case 'PING': {
        const client = this.clients.get(clientId);
        if (client) {
          client.lastPing = Date.now();
          this.sendToClient(client, {
            type: 'PONG',
            roomId: this.id,
            clientId,
            lamport: this.crdt.getLamport(),
            timestamp: Date.now(),
          });
        }
        break;
      }
    }
  }

  private handleClusterMessage(msg: SyncMessage) {
    switch (msg.type) {
      case 'ELEMENT_UPSERT':
      case 'ELEMENT_DELETE': {
        const element: CanvasElement = msg.payload;
        const merged = this.crdt.mergeElement(element);
        if (merged) {
          this.storage.markDirty(this.id);
          this.broadcast(msg);
        }
        break;
      }
      case 'CURSOR_MOVE':
      case 'USER_JOIN':
      case 'USER_LEAVE': {
        this.broadcast(msg);
        break;
      }
    }
  }

  public broadcast(msg: SyncMessage, excludeClientId?: string) {
    const raw = JSON.stringify(msg);
    for (const [id, client] of this.clients.entries()) {
      if (id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(raw);
      }
    }
  }

  private sendToClient(client: ConnectedClient, msg: SyncMessage) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(msg));
    }
  }

  public getPresenceList(): UserPresence[] {
    const list: UserPresence[] = [];
    for (const client of this.clients.values()) {
      list.push({
        clientId: client.id,
        userName: client.userName,
        color: client.color,
        lastActive: client.lastPing,
      });
    }
    return list;
  }

  public clientCount(): number {
    return this.clients.size;
  }
}
