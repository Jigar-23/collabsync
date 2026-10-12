# CollabSync 🌐

[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node Version](https://img.shields.io/badge/node-v20+-green.svg?style=flat&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-v18.3-61DAFB.svg?style=flat&logo=react)](https://react.dev/)
[![WebSockets](https://img.shields.io/badge/transport-WebSockets-blue.svg)]()
[![Redis Pub/Sub](https://img.shields.io/badge/cluster-Redis%20Pub%2FSub-DC382D.svg?style=flat&logo=redis)](https://redis.io/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A high-performance, distributed real-time collaborative workspace engine built with **WebSockets**, **Conflict-Free Replicated Data Types (LWW-CRDT)**, and **Redis Pub/Sub clustering**.

CollabSync enables multiple users to draw on an infinite canvas, type in synchronized notes, and track live remote cursors in real time with low-latency full-duplex communication and deterministic conflict resolution.

---

## 🏛️ System Architecture

```
                    +--------------------------------+
                    |    Collaborating Web Clients   |
                    | (React 18, 60 FPS HTML5 Canvas)|
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
                           (Cross-Node Event Bus)
                                      |
                                      v
                         +--------------------------+
                         |      Redis Cluster       |
                         |  (Cross-Server Pub/Sub)  |
                         +--------------------------+
                                      |
                         +------------v-------------+
                         |  Debounced Write-Behind  |
                         |    Snapshot Persistence  |
                         +--------------------------+
```

---

## 🚀 Key Engineering Highlights

### 1. Deterministic Conflict Resolution (LWW-CRDT)
* **The Problem:** When two users on high-latency connections edit the same shape or note simultaneously, standard web applications suffer race conditions where the slower network packet overwrites earlier work.
* **The Solution:** CollabSync uses a **Last-Write-Wins Element Register (LWW-CRDT)** backed by **Lamport Logical Timestamps**:
  1. Primary comparison: Highest Lamport Clock value wins.
  2. Physical tie-breaker: Millisecond physical timestamp.
  3. Deterministic fallback: Lexicographical client ID comparison.
* **Result:** Every client and server mathematically converges to the exact same state regardless of the order in which packets arrive across the network.

### 2. Multi-Server Horizontal Scaling via Redis Pub/Sub
* Traditional WebSocket servers keep connections in local process memory, making horizontal scaling across multiple instances impossible without breaking rooms.
* CollabSync connects server nodes to a centralized **Redis Pub/Sub message broker**. When User A connected to **Server Node 1** draws an element, Server 1 broadcasts the delta to Redis. **Server Node 2** receives the event and streams it instantly to User B, achieving transparent cross-server collaboration.

### 3. "Airplane Mode" Offline Resilience & Reconnection Queue
* Built with an **offline-first queue**. If a user loses connection (e.g., enters an elevator or enables the built-in *Airplane Mode* toggle), the client continues running with local editing capability.
* Changes are locally buffered and timestamped in `localStorage`. Once connection is restored, the client automatically drains the queue to the server, and the CRDT reconciles remote and offline edits according to logical timestamp ordering.

### 4. 60 FPS HTML5 Canvas & Real-Time Cursor Tracking
* The canvas renders using a hardware-accelerated `requestAnimationFrame` loop with full-frame redrawing and 50ms throttled presence streams.
* Remote collaborators' mouse movements are rendered in real time with distinct identity tags and status avatars.

### 5. Debounced Write-Behind Snapshotting
* Disk I/O on every stroke destroys server throughput. CollabSync implements an asynchronous write-behind worker that aggregates state in memory and flushes atomic snapshots to disk on a debounced timer (2000ms idle interval).

---

## 🧪 Live Chaos Test (The "Airplane Mode" Demo)

You can demonstrate this directly to an interviewer in 30 seconds:

1. Open `http://localhost:3000?room=demo` in **Window A**.
2. Open the same link in an **Incognito Window B** side by side.
3. Draw a circle in Window A $\rightarrow$ It appears live in Window B in real time.
4. In Window B, click the **"Airplane Mode"** button on the toolbar (simulates dropped Wi-Fi).
5. In Window B, draw 3 shapes offline. Notice the HUD reads: `OFFLINE (3 offline edits)`.
6. Meanwhile, in Window A, draw a rectangle online.
7. Now click **"Airplane Mode"** again in Window B to reconnect.
8. **Watch the magic:** Window B immediately syncs its 3 offline shapes to Window A, and Window A's rectangle merges into Window B cleanly without overwriting.

---

## 💻 Quickstart

### 1. Run Complete Cluster with Docker Compose
```bash
docker compose up --build -d
```
* **Web Client:** `http://localhost:3000`
* **Nginx Load Balancer:** `http://localhost:8080`
* **Server Node 1:** `http://localhost:4001`
* **Server Node 2:** `http://localhost:4002`

### 2. Run Locally from Source
```bash
# Install dependencies
make install

# Start backend server in Terminal 1
make start-server

# Start frontend client in Terminal 2
make start-client
```

### 3. Run Test Suite
```bash
make test
```

---

## ⚖️ Design Decisions & Trade-Offs

1. **Why LWW-CRDT over Operational Transformation (OT)?**  
   OT requires a centralized server to maintain a linear history log and transform operations against each other (high server memory complexity and lock contention). State-based / delta-based CRDTs allow peer nodes to converge independently without strict sequential lock coordination.

2. **Why WebSockets over WebRTC DataChannels?**  
   WebSockets provide deterministic delivery guarantees via TCP, predictable NAT traversal without STUN/TURN server requirements, and simple integration with Redis Pub/Sub backend clusters.

3. **Why Debounced Write-Behind Snapshotting?**  
   Synchronous database writes on every socket packet create database connection pool exhaustion under high concurrency. Debounced write-behind decouples real-time in-memory throughput from disk I/O latency.

---

## 📄 License
MIT License. Created by [Jigar](https://github.com/Jigar-23).
