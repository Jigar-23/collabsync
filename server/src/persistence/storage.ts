import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CanvasElement } from '../sync/types.js';

export interface RoomSnapshot {
  roomId: string;
  elements: CanvasElement[];
  version: number;
  updatedAt: number;
}

export class StorageEngine {
  private dataDir: string;
  private dirtyRooms: Set<string> = new Set();
  private flushTimer: NodeJS.Timeout | null = null;
  private roomElementsGetter: (roomId: string) => CanvasElement[];

  constructor(dataDir: string, roomElementsGetter: (roomId: string) => CanvasElement[]) {
    this.dataDir = dataDir;
    this.roomElementsGetter = roomElementsGetter;
    this.init();
  }

  private async init() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
    } catch {}

    // Flush dirty snapshots every 2 seconds
    this.flushTimer = setInterval(() => {
      this.flushDirtyRooms();
    }, 2000);
    this.flushTimer.unref();
  }

  public markDirty(roomId: string) {
    this.dirtyRooms.add(roomId);
  }

  public async loadRoom(roomId: string): Promise<RoomSnapshot | null> {
    const filePath = path.join(this.dataDir, `${encodeURIComponent(roomId)}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  public async saveRoom(roomId: string, elements: CanvasElement[], version: number = 1): Promise<void> {
    const snapshot: RoomSnapshot = {
      roomId,
      elements,
      version,
      updatedAt: Date.now(),
    };
    const filePath = path.join(this.dataDir, `${encodeURIComponent(roomId)}.json`);
    const tempPath = `${filePath}.tmp`;

    await fs.writeFile(tempPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    await fs.rename(tempPath, filePath);
  }

  public async flushDirtyRooms(): Promise<void> {
    if (this.dirtyRooms.size === 0) return;

    const toFlush = Array.from(this.dirtyRooms);
    this.dirtyRooms.clear();

    for (const roomId of toFlush) {
      try {
        const elements = this.roomElementsGetter(roomId);
        await this.saveRoom(roomId, elements);
      } catch (err) {
        console.error(`[Storage] Failed to snapshot room ${roomId}: ${err}`);
      }
    }
  }

  public async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushDirtyRooms();
  }
}
