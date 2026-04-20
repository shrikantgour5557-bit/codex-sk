import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authRouter } from './routes/auth.routes.js';
import { adRouter } from './routes/ad.routes.js';
import { adminRouter } from './routes/admin.routes.js';

export const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'freeadspace-api' });
});

app.use('/api/auth', authRouter);
app.use('/api/ads', adRouter);
app.use('/api/admin', adminRouter);
