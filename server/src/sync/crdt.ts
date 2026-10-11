import { CanvasElement } from './types.js';

export class LWWElementRegister {
  private elements: Map<string, CanvasElement> = new Map();
  private maxLamport: number = 0;

  constructor(initialElements: CanvasElement[] = []) {
    for (const elem of initialElements) {
      this.mergeElement(elem);
    }
  }

  public getLamport(): number {
    return this.maxLamport;
  }

  public tick(incomingLamport?: number): number {
    if (incomingLamport !== undefined) {
      this.maxLamport = Math.max(this.maxLamport, incomingLamport);
    }
    this.maxLamport += 1;
    return this.maxLamport;
  }

  /**
   * Deterministically merges an element according to LWW-CRDT rules:
   * 1. Higher Lamport timestamp wins
   * 2. If equal, higher physical timestamp wins
   * 3. If equal, higher clientId string wins
   */
  public mergeElement(incoming: CanvasElement): boolean {
    this.tick(incoming.lamport);

    const existing = this.elements.get(incoming.id);
    if (!existing) {
      this.elements.set(incoming.id, { ...incoming });
      return true;
    }

    if (this.isIncomingWinning(existing, incoming)) {
      this.elements.set(incoming.id, { ...incoming });
      return true;
    }

    return false;
  }

  private isIncomingWinning(existing: CanvasElement, incoming: CanvasElement): boolean {
    if (incoming.lamport > existing.lamport) {
      return true;
    }
    if (incoming.lamport < existing.lamport) {
      return false;
    }

    // Tie-breaker 1: Physical timestamp
    if (incoming.updatedAt > existing.updatedAt) {
      return true;
    }
    if (incoming.updatedAt < existing.updatedAt) {
      return false;
    }

    // Tie-breaker 2: ClientId string comparison
    return incoming.clientId > existing.clientId;
  }

  public getElement(id: string): CanvasElement | undefined {
    return this.elements.get(id);
  }

  public getAllActive(): CanvasElement[] {
    const active: CanvasElement[] = [];
    for (const elem of this.elements.values()) {
      if (!elem.deleted) {
        active.push(elem);
      }
    }
    return active;
  }

  public getAll(): CanvasElement[] {
    return Array.from(this.elements.values());
  }

  public count(): number {
    return this.elements.size;
  }
}
