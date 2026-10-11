export type ElementType = 'stroke' | 'rectangle' | 'circle' | 'text' | 'sticky';

export interface CanvasElement {
  id: string;
  type: ElementType;
  data: Record<string, any>;
  lamport: number;
  updatedAt: number;
  clientId: string;
  deleted?: boolean;
}

export type ActionType = 
  | 'INIT_STATE'
  | 'ELEMENT_UPSERT'
  | 'ELEMENT_DELETE'
  | 'CURSOR_MOVE'
  | 'USER_JOIN'
  | 'USER_LEAVE'
  | 'PING'
  | 'PONG'
  | 'ACK';

export interface SyncMessage {
  type: ActionType;
  roomId: string;
  clientId: string;
  lamport: number;
  timestamp: number;
  payload?: any;
}

export interface UserPresence {
  clientId: string;
  userName: string;
  color: string;
  cursor?: { x: number; y: number };
  lastActive: number;
}
