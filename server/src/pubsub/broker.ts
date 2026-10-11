import Redis from 'ioredis';
import { SyncMessage } from '../sync/types.js';

export type MessageHandler = (channel: string, message: SyncMessage) => void;

export class PubSubBroker {
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private isConnected: boolean = false;
  private serverId: string;

  constructor(redisUrl?: string) {
    this.serverId = `srv-${Math.random().toString(36).substring(2, 9)}`;

    if (redisUrl) {
      try {
        this.pubClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          retryStrategy: () => 2000,
          lazyConnect: true,
        });

        this.subClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          retryStrategy: () => 2000,
          lazyConnect: true,
        });

        this.initRedis();
      } catch (err) {
        console.warn(`[PubSub] Redis not available, using in-memory bus: ${err}`);
      }
    }
  }

  private async initRedis() {
    if (!this.pubClient || !this.subClient) return;

    try {
      await Promise.all([this.pubClient.connect(), this.subClient.connect()]);
      this.isConnected = true;
      console.log(`[PubSub] Connected to Redis cluster broker (${this.serverId})`);

      this.subClient.on('message', (channel, messageStr) => {
        try {
          const envelope = JSON.parse(messageStr);
          // Don't re-process messages originated by this exact server instance
          if (envelope.originServer === this.serverId) return;

          const handlers = this.handlers.get(channel);
          if (handlers) {
            for (const handler of handlers) {
              handler(channel, envelope.data);
            }
          }
        } catch (err) {
          console.error(`[PubSub] Error parsing cluster message: ${err}`);
        }
      });
    } catch (err) {
      this.isConnected = false;
      console.warn(`[PubSub] Redis connection failed, running in local in-memory mode`);
    }
  }

  public async subscribe(channel: string, handler: MessageHandler) {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
      if (this.isConnected && this.subClient) {
        await this.subClient.subscribe(channel);
      }
    }
    this.handlers.get(channel)!.add(handler);
  }

  public async unsubscribe(channel: string, handler: MessageHandler) {
    const set = this.handlers.get(channel);
    if (!set) return;

    set.delete(handler);
    if (set.size === 0) {
      this.handlers.delete(channel);
      if (this.isConnected && this.subClient) {
        await this.subClient.unsubscribe(channel);
      }
    }
  }

  public async publish(channel: string, message: SyncMessage) {
    if (this.isConnected && this.pubClient) {
      const envelope = {
        originServer: this.serverId,
        data: message,
      };
      await this.pubClient.publish(channel, JSON.stringify(envelope));
    }
  }

  public getServerId(): string {
    return this.serverId;
  }

  public hasRedis(): boolean {
    return this.isConnected;
  }

  public async close() {
    if (this.pubClient) await this.pubClient.quit();
    if (this.subClient) await this.subClient.quit();
  }
}
