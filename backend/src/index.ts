import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import staticFiles from '@fastify/static';
import path from 'path';

import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { foodRoutes } from './routes/foods.js';
import { logRoutes } from './routes/logs.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { wsRoutes } from './routes/websocket.js';
import { startVisionWorker } from './workers/visionWorker.js';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  },
});

// ── Plugins ──────────────────────────────────────────────────────────────────
await app.register(cors, {
  origin: true,
  credentials: true,
});

await app.register(jwt, {
  secret: process.env.JWT_SECRET!,
});

await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

await app.register(rateLimit, {
  max: 200,
  timeWindow: '1 minute',
});

await app.register(websocket);

// ── Serve local upload folder (dev only) ─────────────────────────────────
if (process.env.STORAGE_MODE !== 'cloudinary') {
  const uploadDir = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
  await app.register(staticFiles, {
    root:   uploadDir,
    prefix: '/uploads/',
  });
}

// ── Auth decorator ────────────────────────────────────────────────────────────
app.decorate('authenticate', async function (request: any, reply: any) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(userRoutes, { prefix: '/api/users' });
await app.register(foodRoutes, { prefix: '/api/foods' });
await app.register(logRoutes, { prefix: '/api/logs' });
await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
await app.register(wsRoutes, { prefix: '/ws' });

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }));

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`🚀 FitLens API running on http://0.0.0.0:${PORT}`);

  // Start the vision job worker
  startVisionWorker();
  app.log.info('⚙️  Vision worker started');
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
