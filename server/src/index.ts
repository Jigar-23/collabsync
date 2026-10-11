import { CollabServer } from './websocket/server.js';
import * as path from 'node:path';

const PORT = parseInt(process.env.PORT || '4000', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data', 'rooms');
const REDIS_URL = process.env.REDIS_URL || undefined;

console.log(`
   _____      _ _       _     _____                 
  / ____|    | | |     | |   / ____|                
 | |     ___ | | | __ _| |__| (___  _   _ _ __   ___ 
 | |    / _ \| | |/ _` + "`" + ` | '_ \\___ \| | | | '_ \ / __|
 | |___| (_) | | | (_| | |_) |___) | |_| | | | | (__ 
  \_____\___/|_|_|\__,_|_.__/_____/ \__, |_| |_|\___|
                                      __/ |          
 Distributed Real-Time Collaborative |___/  Engine
 WebSockets | CRDT Conflict Resolution | Redis Pub/Sub
`);

const server = new CollabServer({
  port: PORT,
  dataDir: DATA_DIR,
  redisUrl: REDIS_URL,
});

server.listen(PORT).then(() => {
  console.log(`[CollabSync] Ready for connections on port ${PORT}`);
  console.log(`[CollabSync] Health endpoint: http://localhost:${PORT}/health`);
  console.log(`[CollabSync] Telemetry endpoint: http://localhost:${PORT}/stats`);
});

// Handle graceful shutdown
const shutdown = async () => {
  console.log('\n[CollabSync] Shutting down gracefully...');
  await server.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
