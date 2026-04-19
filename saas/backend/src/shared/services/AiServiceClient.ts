import { env } from '../../config/env';

export class AiServiceClient {
  /**
   * Acts as the interface between the Node.js backend and the stateless Python AI service.
   * Right now, it simulates the synchronous HTTP post.
   */
  static async analyzeError(errorEventId: string, payload: any): Promise<string> {
    console.log(`[AiServiceClient] Forwarding Event ${errorEventId} to AI Service...`);
    
    const aiServiceUrl = env.AI_SERVICE_URL;

    try {
      const response = await fetch(aiServiceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payload: {
            error_event_id: errorEventId,
            raw_message: payload.rawBlock,
            context: payload.contextLines,
          },
          config: {
            parserModel: env.PARSER_LLM_MODEL,
            debuggerModel: env.DEBUGGER_LLM_MODEL,
            fallbackModel: env.FALLBACK_LLM_MODEL ?? env.DEBUGGER_LLM_MODEL,
            baseUrl: env.LLM_BASE_URL,
            apiKeys: {}
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Service returned status ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as { report: string };
      return data.report;
    } catch (error) {
      console.error(`[AiServiceClient] Failed to analyze error ${errorEventId}:`, error);
      throw error;
    }
  }
}
