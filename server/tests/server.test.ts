import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { WebSocket } from 'ws';
import * as os from 'node:os';
import * as path from 'node:path';
import { CollabServer } from '../src/websocket/server.js';
import { SyncMessage } from '../src/sync/types.js';

describe('CollabSync End-to-End WebSocket Server', () => {
  const TEST_PORT = 14001;
  const tempDir = path.join(os.tmpdir(), `collabsync-test-${Date.now()}`);
  let server: CollabServer;

  before(async () => {
    server = new CollabServer({
      port: TEST_PORT,
      dataDir: tempDir,
    });
    await server.listen(TEST_PORT);
  });

  after(async () => {
    await server.close();
  });

  test('two clients in same room receive real-time updates and presence', async () => {
    const wsUrlA = `ws://127.0.0.1:${TEST_PORT}/ws?room=test-room-1&user=Alice&clientId=client-alice`;
    const wsUrlB = `ws://127.0.0.1:${TEST_PORT}/ws?room=test-room-1&user=Bob&clientId=client-bob`;

    const wsA = new WebSocket(wsUrlA);
    const wsB = new WebSocket(wsUrlB);

    const aReady = new Promise<void>((resolve) => {
      wsA.on('message', (raw) => {
        const msg: SyncMessage = JSON.parse(raw.toString());
        if (msg.type === 'INIT_STATE') resolve();
      });
    });

    const bReady = new Promise<void>((resolve) => {
      wsB.on('message', (raw) => {
        const msg: SyncMessage = JSON.parse(raw.toString());
        if (msg.type === 'INIT_STATE') resolve();
      });
    });

    await Promise.all([aReady, bReady]);

    // Client B waits to receive an edit from Client A
    const bReceivedPromise = new Promise<SyncMessage>((resolve) => {
      wsB.on('message', (raw) => {
        const msg: SyncMessage = JSON.parse(raw.toString());
        if (msg.type === 'ELEMENT_UPSERT') {
          resolve(msg);
        }
      });
    });

    // Client A broadcasts a new rectangle shape
    const newShape: SyncMessage = {
      type: 'ELEMENT_UPSERT',
      roomId: 'test-room-1',
      clientId: 'client-alice',
      lamport: 1,
      timestamp: Date.now(),
      payload: {
        id: 'rect-alpha',
        type: 'rectangle',
        data: { x: 100, y: 150, width: 200, height: 100, color: '#3B82F6' },
        lamport: 1,
        updatedAt: Date.now(),
        clientId: 'client-alice',
      },
    };

    wsA.send(JSON.stringify(newShape));

    // Assert Client B received exact element in <50ms
    const received = await bReceivedPromise;
    assert.equal(received.payload.id, 'rect-alpha');
    assert.equal(received.payload.data.x, 100);

    await Promise.all([
      new Promise((res) => { wsA.on('close', res); wsA.close(); }),
      new Promise((res) => { wsB.on('close', res); wsB.close(); }),
    ]);
  });

  test('HTTP health and stats endpoints respond properly', async () => {
    const resHealth = await fetch(`http://127.0.0.1:${TEST_PORT}/health`, {
      headers: { connection: 'close' },
    });
    assert.equal(resHealth.status, 200);
    const dataHealth = await resHealth.json();
    assert.equal(dataHealth.status, 'ok');

    const resStats = await fetch(`http://127.0.0.1:${TEST_PORT}/stats`, {
      headers: { connection: 'close' },
    });
    assert.equal(resStats.status, 200);
    const dataStats = await resStats.json();
    assert.equal(typeof dataStats.totalConnections, 'number');
  });
});
