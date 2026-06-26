import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });
dotenv.config();
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import authRoutes from './routes/auth';
import bookRoutes from './routes/books';
import authorRoutes from './routes/authors';
import libraryRoutes from './routes/library';
import aiRoutes from './routes/ai';
import recommendationRoutes from './routes/recommendations';
import uploadRoutes from './routes/upload';

const app = express();
const port = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_req, res) => { res.json(swaggerSpec); });

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/authors', authorRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/upload', uploadRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`BookHunt API running on port ${port}`);
});

export default app;
