import { useState, useEffect, useRef, useCallback } from 'react';
import { CanvasElement, SyncMessage, UserPresence } from '../engine/types';
import { OfflineQueue } from '../engine/offlineQueue';

export interface UseCollabSyncOptions {
  wsUrl: string;
  roomId: string;
  userName: string;
  clientId: string;
}

export function useCollabSync({ wsUrl, roomId, userName, clientId }: UseCollabSyncOptions) {
  const [elements, setElements] = useState<Map<string, CanvasElement>>(new Map());
  const [users, setUsers] = useState<Map<string, UserPresence>>(new Map());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isAirplaneMode, setIsAirplaneMode] = useState<boolean>(false);
  const [pingMs, setPingMs] = useState<number>(0);
  const [offlineCount, setOfflineCount] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const lamportRef = useRef<number>(0);
  const offlineQueueRef = useRef<OfflineQueue>(new OfflineQueue(roomId));
  const pingStartRef = useRef<number>(0);
  const elementsRef = useRef<Map<string, CanvasElement>>(new Map());

  // Keep ref synchronized with state for callback closures
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  const tickLamport = useCallback((incoming?: number) => {
    if (incoming !== undefined) {
      lamportRef.current = Math.max(lamportRef.current, incoming);
    }
    lamportRef.current += 1;
    return lamportRef.current;
  }, []);

  // Deterministic LWW Merge
  const mergeElement = useCallback((incoming: CanvasElement): boolean => {
    tickLamport(incoming.lamport);
    const existing = elementsRef.current.get(incoming.id);

    if (!existing) {
      setElements((prev) => new Map(prev).set(incoming.id, incoming));
      return true;
    }

    let incomingWins = false;
    if (incoming.lamport > existing.lamport) {
      incomingWins = true;
    } else if (incoming.lamport === existing.lamport) {
      if (incoming.updatedAt > existing.updatedAt) {
        incomingWins = true;
      } else if (incoming.updatedAt === existing.updatedAt) {
        incomingWins = incoming.clientId > existing.clientId;
      }
    }

    if (incomingWins) {
      setElements((prev) => new Map(prev).set(incoming.id, incoming));
      return true;
    }
    return false;
  }, [tickLamport]);

  // Connect to WebSocket
  useEffect(() => {
    if (isAirplaneMode) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    let reconnectTimer: ReturnType<typeof setTimeout>;
    const url = `${wsUrl}?room=${encodeURIComponent(roomId)}&user=${encodeURIComponent(userName)}&clientId=${encodeURIComponent(clientId)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);

      // Drain offline queue upon reconnect
      const queued = offlineQueueRef.current.drain();
      setOfflineCount(0);
      if (queued.length > 0) {
        console.log(`[CollabSync] Reconnected! Flushing ${queued.length} offline changes...`);
        for (const msg of queued) {
          ws.send(JSON.stringify(msg));
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: SyncMessage = JSON.parse(event.data);

        switch (msg.type) {
          case 'INIT_STATE': {
            const initialMap = new Map<string, CanvasElement>();
            for (const elem of msg.payload.elements) {
              initialMap.set(elem.id, elem);
            }
            setElements(initialMap);

            const initialUsers = new Map<string, UserPresence>();
            for (const user of msg.payload.users) {
              if (user.clientId !== clientId) {
                initialUsers.set(user.clientId, user);
              }
            }
            setUsers(initialUsers);
            break;
          }

          case 'ELEMENT_UPSERT':
          case 'ELEMENT_DELETE': {
            mergeElement(msg.payload);
            break;
          }

          case 'CURSOR_MOVE': {
            if (msg.clientId !== clientId) {
              setUsers((prev) => {
                const next = new Map(prev);
                const existing = next.get(msg.clientId) || {
                  clientId: msg.clientId,
                  userName: msg.payload.userName || 'Anonymous',
                  color: msg.payload.color || '#3B82F6',
                  lastActive: Date.now(),
                };
                next.set(msg.clientId, {
                  ...existing,
                  cursor: msg.payload.cursor,
                  lastActive: Date.now(),
                });
                return next;
              });
            }
            break;
          }

          case 'USER_JOIN': {
            if (msg.clientId !== clientId) {
              setUsers((prev) => {
                const next = new Map(prev);
                next.set(msg.clientId, {
                  clientId: msg.clientId,
                  userName: msg.payload.userName,
                  color: msg.payload.color,
                  lastActive: Date.now(),
                });
                return next;
              });
            }
            break;
          }

          case 'USER_LEAVE': {
            setUsers((prev) => {
              const next = new Map(prev);
              next.delete(msg.clientId);
              return next;
            });
            break;
          }

          case 'PONG': {
            const rtt = Date.now() - pingStartRef.current;
            setPingMs(rtt);
            break;
          }
        }
      } catch (err) {
        console.error('[CollabSync] Failed to process message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Auto-reconnect after 2 seconds
      reconnectTimer = setTimeout(() => {
        if (!isAirplaneMode) {
          setIsConnected(false);
        }
      }, 2000);
    };

    // Ping interval to measure latency
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        pingStartRef.current = Date.now();
        ws.send(JSON.stringify({ type: 'PING', roomId, clientId, lamport: lamportRef.current, timestamp: Date.now() }));
      }
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      clearTimeout(reconnectTimer);
      ws.close();
    };
  }, [wsUrl, roomId, userName, clientId, isAirplaneMode, mergeElement]);

  // Dispatch an element mutation (optimistic local + network or offline queue)
  const upsertElement = useCallback((elem: CanvasElement) => {
    elem.lamport = tickLamport();
    elem.updatedAt = Date.now();
    elem.clientId = clientId;

    // 1. Optimistic local update (instant render)
    mergeElement(elem);

    const msg: SyncMessage = {
      type: 'ELEMENT_UPSERT',
      roomId,
      clientId,
      lamport: elem.lamport,
      timestamp: elem.updatedAt,
      payload: elem,
    };

    // 2. Broadcast or queue
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isAirplaneMode) {
      wsRef.current.send(JSON.stringify(msg));
    } else {
      offlineQueueRef.current.enqueue(msg);
      setOfflineCount(offlineQueueRef.current.size());
    }
  }, [roomId, clientId, isAirplaneMode, mergeElement, tickLamport]);

  // Throttled cursor position broadcasting
  const lastCursorSend = useRef<number>(0);
  const sendCursor = useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastCursorSend.current < 50) return; // 50ms throttle
    lastCursorSend.current = now;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isAirplaneMode) {
      wsRef.current.send(
        JSON.stringify({
          type: 'CURSOR_MOVE',
          roomId,
          clientId,
          lamport: lamportRef.current,
          timestamp: now,
          payload: { cursor: { x, y }, userName },
        })
      );
    }
  }, [roomId, clientId, userName, isAirplaneMode]);

  const toggleAirplaneMode = useCallback(() => {
    setIsAirplaneMode((prev) => !prev);
  }, []);

  return {
    elements: Array.from(elements.values()).filter((e) => !e.deleted),
    users: Array.from(users.values()),
    isConnected,
    isAirplaneMode,
    pingMs,
    offlineCount,
    upsertElement,
    sendCursor,
    toggleAirplaneMode,
  };
}
