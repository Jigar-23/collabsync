# CollabSync

A real-time collaborative canvas with conflict-free replication (LWW-CRDT) and Redis Pub/Sub.

CollabSync is a real-time collaborative whiteboard built with TypeScript, Node.js, WebSockets, and Redis. It lets multiple users draw shapes, add sticky notes, and track each other's live cursors on a shared canvas.

I built this project to explore how distributed systems maintain consistency across stateful connections—specifically dealing with out-of-order network packets, concurrent edits, offline resilience, and scaling WebSockets across multiple server nodes.

---

## Architecture

```
                    +--------------------------------+
                    |    Collaborating Web Clients   |
                    | (React 18, HTML5 Canvas, WS)   |
                    +---------------+----------------+
                                    |
                    +---------------+----------------+
                    |      Nginx Load Balancer       |
                    |  (Round-Robin Reverse Proxy)   |
                    +-------+----------------+-------+
                            |                |
             WebSocket /ws  |                |  WebSocket /ws
                            v                v
                 +-------------------+  +-------------------+
                 | Backend Node 1    |  | Backend Node 2    |
                 | (Port 4001)       |  | (Port 4002)       |
                 +---------+---------+  +---------+---------+
                           |                      |
                           |                      |
                           +----------+-----------+
                                      |
                           Redis Pub/Sub Channels
                           (room:<id>:events)
                                      |
                                      v
                         +--------------------------+
                         |      Redis Broker        |
                         |  (Cross-Server Pub/Sub)  |
                         +--------------------------+
                                      |
                         +------------v-------------+
                         |  Periodic Snapshotting   |
                         |  (Atomic File Writes)    |
                         +--------------------------+
```

---

## How It Works

### 1. Conflict-Free Replicated Data Types (LWW-CRDT)
In a real-time canvas, two users might edit or move the same element at the same time. If clients simply overwrite state based on arrival order, network latency can cause clients to see divergent states.

CollabSync uses a **Last-Write-Wins Element Register (LWW-CRDT)** backed by **Lamport Logical Clocks**:
1. **Lamport Clock:** Each edit increments the sender's logical clock. Higher Lamport timestamps take precedence.
2. **Physical Timestamp:** If Lamport clocks match, the higher physical timestamp wins.
3. **Client ID Fallback:** If both clocks match, ties are broken deterministically by client ID string comparison.

Because all nodes apply the exact same merge rules, every client converges to the identical canvas state regardless of packet arrival order.

### 2. Multi-Server Scaling with Redis Pub/Sub
WebSocket connections are persistent TCP sockets tied to a specific backend process. When scaling horizontally across multiple Node.js instances behind a load balancer, users in the same room might be connected to different servers.

CollabSync connects all backend instances to a shared **Redis Pub/Sub broker**:
* When a client on Node 1 modifies an element, Node 1 applies the CRDT update locally and publishes it to `room:<id>:events`.
* Node 2 receives the Redis broadcast and immediately forwards the update to its connected clients.

### 3. Offline Mode & Reconnection Queue
Network drops shouldn't cause lost work. The client includes an offline buffer:
* If the WebSocket disconnects (or if the user clicks the built-in **Airplane Mode** toggle), edits are queued in browser `localStorage`.
* Users can keep drawing and placing notes while offline.
* When the connection recovers, the client flushes its queued mutations to the server. The server's CRDT engine merges them with any remote edits that happened in the meantime.

### 4. HTML5 Canvas & Cursor Tracking
* Rendered on an HTML5 canvas using a `requestAnimationFrame` loop.
* Mouse movements are throttled to 50ms intervals before sending to avoid flooding WebSocket buffers while keeping remote cursor movement smooth.

### 5. Snapshot Persistence
Writing room state to disk on every single mouse stroke causes unnecessary I/O bottlenecks. CollabSync keeps the active CRDT register in memory and runs a background timer (every 2 seconds) that flushes atomic JSON snapshots to disk only if the room has pending modifications.

---

## Testing Offline Sync (The Airplane Mode Demo)

You can test the CRDT conflict resolution directly in your browser:

1. Open `http://localhost:3000?room=demo` in **Window A**.
2. Open the same URL in an **Incognito Window B** side by side.
3. Draw a shape in Window A — it shows up in Window B in real time.
4. In Window B, toggle **"Airplane Mode"** on the top toolbar (simulates losing Wi-Fi).
5. Draw a couple of shapes in Window B while disconnected (the HUD will show pending offline edits).
6. In Window A (still online), draw another shape.
7. Toggle **"Airplane Mode"** off in Window B.
8. Window B reconnects, drains its local queue, and both windows merge their edits cleanly without overwriting each other.

---

## Getting Started

### Prerequisites
* Node.js v20+
* Docker & Docker Compose (recommended)

### Run with Docker Compose (Recommended)
This spins up the Nginx load balancer, Redis broker, two backend server nodes, and the React client:

```bash
docker compose up --build -d
```

* **Web App:** `http://localhost:3000`
* **Nginx Reverse Proxy:** `http://localhost:8080`
* **Backend Node 1:** `http://localhost:4001`
* **Backend Node 2:** `http://localhost:4002`

### Run Locally from Source

1. **Install dependencies:**
   ```bash
   make install
   ```

2. **Start the backend server:**
   ```bash
   make start-server
   ```

3. **Start the frontend client (in another terminal):**
   ```bash
   make start-client
   ```

4. **Run CRDT unit tests:**
   ```bash
   make test
   ```

---

## Design Decisions & Trade-Offs

* **LWW-CRDT vs. Operational Transformation (OT):** OT systems (like Google Docs) require a central server to coordinate a linear operations log and transform operations against each other. CRDTs allow peer nodes to merge state independently without central lock coordination, which simplifies multi-server architectures.
* **WebSockets over WebRTC:** WebSockets provide reliable TCP delivery, straightforward reconnection logic, and clean integration with backend Redis event brokers without needing STUN/TURN infrastructure.
* **Element-Level LWW Register:** For a whiteboard where users create, drag, and modify discrete objects (rectangles, circles, notes), an element-level LWW-CRDT is much simpler and faster than complex sequence CRDTs like RGA or Fugue.

---

## Scope & Limitations

* **Viewport Coordinates:** The canvas is currently sized to the browser window and does not implement infinite zoom/pan coordinates.
* **Element-Level Granularity:** Text inside sticky notes is resolved at the whole-note level rather than character-by-character collaborative typing.
* **Local Disk Snapshots:** Room snapshots are saved as JSON files on the local filesystem; in a production deployment, this would write to S3 or a document store.

---

## License

MIT License. Built by [Jigar](https://github.com/Jigar-23).
