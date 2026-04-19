import './config/loadEnv';

import express from 'express';
import cors from 'cors';
import swaggerUi from "swagger-ui-express";
import { env } from './config/env';
import { swaggerSpec } from "./config/swagger";
import authRoutes from "./modules/auth/auth.routes";
import projectRoutes from "./modules/project/project.routes";
import webhookRoutes from "./modules/webhook/webhook.routes";
import { errorHandler } from "./shared/middlewares/error.middleware";

import "./modules/webhook/IngestionWorker";

const app = express();

app.use(cors());
app.use(express.json());

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/webhooks', webhookRoutes);

// Add healthcheck route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Global Error Handler
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🚀 SaaS Backend running on port ${env.PORT}`);
});
