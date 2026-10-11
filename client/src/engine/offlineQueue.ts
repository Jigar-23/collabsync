import { SyncMessage } from './types';

const STORAGE_KEY_PREFIX = 'collabsync_offline_';

export class OfflineQueue {
  private roomId: string;
  private queue: SyncMessage[] = [];

  constructor(roomId: string) {
    this.roomId = roomId;
    this.load();
  }

  private load() {
    try {
      const data = localStorage.getItem(`${STORAGE_KEY_PREFIX}${this.roomId}`);
      if (data) {
        this.queue = JSON.parse(data);
      }
    } catch {}
  }

  private persist() {
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${this.roomId}`, JSON.stringify(this.queue));
    } catch {}
  }

  public enqueue(msg: SyncMessage) {
    this.queue.push(msg);
    this.persist();
  }

  public drain(): SyncMessage[] {
    const items = [...this.queue];
    this.queue = [];
    this.persist();
    return items;
  }

  public size(): number {
    return this.queue.length;
  }

  public clear() {
    this.queue = [];
    this.persist();
  }
}
