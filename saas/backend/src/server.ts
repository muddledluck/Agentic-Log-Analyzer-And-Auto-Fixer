import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import authRoutes from "./modules/auth/auth.routes";
import projectRoutes from "./modules/project/project.routes";
import webhookRoutes from "./modules/webhook/webhook.routes";

import "./modules/webhook/IngestionWorker";

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/webhooks', webhookRoutes);

// Add healthcheck route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(env.PORT, () => {
  console.log(`🚀 SaaS Backend running on port ${env.PORT}`);
});
