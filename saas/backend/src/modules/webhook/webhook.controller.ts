import { Request, Response } from 'express';
import { catchAsync } from "../../shared/utils/catchAsync";
import { WebhookService } from "./webhook.service";
import { UnauthorizedError } from "../../shared/errors/AppError";

export const ingestError = catchAsync(async (req: Request, res: Response) => {
  const apiKeyHeader = req.headers["x-api-key"];

  if (!apiKeyHeader || typeof apiKeyHeader !== "string") {
    throw new UnauthorizedError("Unauthorized: Missing x-api-key header");
  }

  const result = await WebhookService.processIngestion(apiKeyHeader, req.body);

  if (result.isDuplicate) {
    // Abort 202 if duplicate
    res.status(202).json({ message: "Accepted (Duplicate dropped)" });
    return;
  }

  res.status(202).json({ message: "Accepted (Queued for processing)" });
});
