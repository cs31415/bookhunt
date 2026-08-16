import dotenv from 'dotenv';
import path from 'path';
const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env.local'), override: true, quiet: true });
dotenv.config({ path: path.join(root, '.env'), quiet: true });
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import bookRoutes from './routes/books';
import authorRoutes from './routes/authors';
import libraryRoutes from './routes/library';
import searchRoutes from './routes/search';
import aiRoutes from './routes/ai';
import recommendationRoutes from './routes/recommendations';
import importRoutes from './routes/import';
import messageRoutes from './routes/messages';
import cannedSearchRoutes from './routes/canned-searches';
import { requestLogger } from './middleware/requestLogger';
import { describeSchemaGap, findSchemaGap } from './lib/schema/check-schema';

const app = express();
const port = process.env.PORT || 3001;

// Behind the BFF (LOS-119) every request arrives from one IP, which would put
// every reader in the same express-rate-limit bucket -- 20 logins per 15
// minutes for the whole app. Trusting the proxy makes req.ip the caller's
// address again, taken from X-Forwarded-For.
//
// A hop count, never `true`: `true` would let anyone who can reach this port
// directly forge the header, and express-rate-limit refuses to run under a
// permissive setting for that reason. Unset means no proxy, which is how a
// directly-exposed API should stay.
const trustedProxyHops = Number(process.env.TRUSTED_PROXY_HOPS);
if (Number.isInteger(trustedProxyHops) && trustedProxyHops > 0) {
  app.set('trust proxy', trustedProxyHops);
}

app.use(requestLogger);
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => { res.json(swaggerSpec); });

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/authors', authorRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/import', importRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/canned-searches', cannedSearchRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * Refuses to start against a database that is behind this build.
 *
 * Exiting rather than warning, because a container that fails to start is a
 * deploy that visibly failed, while one serving 500s from half its routes
 * looks healthy to everything except the reader.
 *
 * A connection failure is deliberately not fatal: the pool retries, nothing
 * else here has ever required the database at boot, and turning a transient
 * blip into a crash loop would be a worse failure than the one this prevents.
 */
async function start() {
  if (process.env.SKIP_SCHEMA_CHECK !== 'true') {
    try {
      const gap = await findSchemaGap();
      if (gap.missingTables.length > 0 || gap.missingFunctions.length > 0) {
        console.error(describeSchemaGap(gap));
        process.exit(1);
      }
    } catch (error) {
      console.warn('Could not check the schema; starting anyway.', error);
    }
  }

  app.listen(port, () => {
    console.log(`BookHunt API running on port ${port}`);
  });
}

start();

export default app;
