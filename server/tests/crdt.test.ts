import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { LWWElementRegister } from '../src/sync/crdt.js';
import { CanvasElement } from '../src/sync/types.js';

describe('CRDT LWW Element Register', () => {
  test('should store and retrieve newly added elements', () => {
    const reg = new LWWElementRegister();
    const elem: CanvasElement = {
      id: 'shape-1',
      type: 'rectangle',
      data: { x: 10, y: 20, width: 100, height: 50, color: '#ff0000' },
      lamport: 1,
      updatedAt: 1000,
      clientId: 'client-A',
    };

    const updated = reg.mergeElement(elem);
    assert.equal(updated, true);
    assert.equal(reg.getElement('shape-1')?.data.x, 10);
  });

  test('higher lamport clock should overwrite lower lamport clock', () => {
    const reg = new LWWElementRegister();

    const v1: CanvasElement = {
      id: 'shape-1',
      type: 'rectangle',
      data: { x: 10, y: 20 },
      lamport: 1,
      updatedAt: 1000,
      clientId: 'client-A',
    };

    const v2: CanvasElement = {
      id: 'shape-1',
      type: 'rectangle',
      data: { x: 50, y: 70 },
      lamport: 2,
      updatedAt: 1005,
      clientId: 'client-B',
    };

    reg.mergeElement(v1);
    reg.mergeElement(v2);

    assert.equal(reg.getElement('shape-1')?.data.x, 50);
  });

  test('out-of-order delivery should still converge to identical state', () => {
    const regOrder1 = new LWWElementRegister();
    const regOrder2 = new LWWElementRegister();

    const older: CanvasElement = {
      id: 'stroke-1',
      type: 'stroke',
      data: { points: [0, 0] },
      lamport: 1,
      updatedAt: 500,
      clientId: 'client-A',
    };

    const newer: CanvasElement = {
      id: 'stroke-1',
      type: 'stroke',
      data: { points: [0, 0, 10, 10] },
      lamport: 3,
      updatedAt: 900,
      clientId: 'client-B',
    };

    // Client 1 receives older then newer
    regOrder1.mergeElement(older);
    regOrder1.mergeElement(newer);

    // Client 2 receives newer then older (network delay / out of order)
    regOrder2.mergeElement(newer);
    regOrder2.mergeElement(older);

    // Both MUST converge to identical state
    assert.deepEqual(regOrder1.getElement('stroke-1'), regOrder2.getElement('stroke-1'));
    assert.equal(regOrder1.getElement('stroke-1')?.data.points.length, 4);
  });

  test('tie-breaker by client ID when timestamps match exactly', () => {
    const reg = new LWWElementRegister();

    const editAlice: CanvasElement = {
      id: 'text-1',
      type: 'text',
      data: { text: 'Hello from Alice' },
      lamport: 5,
      updatedAt: 1000,
      clientId: 'Alice',
    };

    const editBob: CanvasElement = {
      id: 'text-1',
      type: 'text',
      data: { text: 'Hello from Bob' },
      lamport: 5,
      updatedAt: 1000,
      clientId: 'Bob',
    };

    reg.mergeElement(editAlice);
    reg.mergeElement(editBob);

    // 'Bob' > 'Alice' lexicographically, so Bob wins tie
    assert.equal(reg.getElement('text-1')?.data.text, 'Hello from Bob');
  });

  test('tombstone deletion properly excludes element from active list', () => {
    const reg = new LWWElementRegister();
    reg.mergeElement({
      id: 'elem-1',
      type: 'circle',
      data: { radius: 15 },
      lamport: 1,
      updatedAt: 100,
      clientId: 'c1',
    });

    assert.equal(reg.getAllActive().length, 1);

    // Delete with higher lamport
    reg.mergeElement({
      id: 'elem-1',
      type: 'circle',
      data: {},
      lamport: 2,
      updatedAt: 200,
      clientId: 'c1',
      deleted: true,
    });

    assert.equal(reg.getAllActive().length, 0);
  });
});
