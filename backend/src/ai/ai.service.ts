import { Injectable, Logger } from '@nestjs/common';
import { BuiltinFleetAssistantProvider } from './builtin-fleet-assistant.provider';
import type { FleetAssistantContext, FleetAssistantResponse } from './fleet-assistant.provider';
import { OpenAiFleetAssistantProvider } from './openai-fleet-assistant.provider';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  constructor(private readonly builtin: BuiltinFleetAssistantProvider, private readonly openai: OpenAiFleetAssistantProvider) {}

  async ask(message: string, context: FleetAssistantContext): Promise<FleetAssistantResponse> {
    if (process.env.AI_PROVIDER?.trim().toLowerCase() !== 'openai') return this.builtin.ask(message, context);
    if (!this.openai.isAvailable()) {
      this.logger.warn(JSON.stringify({ requestId: context.requestId, provider: 'openai', result: 'configuration_fallback' }));
      return this.builtin.ask(message, context);
    }
    try { return await this.openai.ask(message, context); }
    catch (error) {
      this.logger.warn(JSON.stringify({ requestId: context.requestId, provider: 'openai', result: 'fallback_to_builtin', ...safeProviderError(error) }));
      return this.builtin.ask(message, context);
    }
  }
}

function safeProviderError(error: unknown) {
  if (!error || typeof error !== 'object') return { category: 'unknown' };
  const value = error as Record<string, unknown>;
  return {
    category: typeof value.name === 'string' ? value.name : 'unknown',
    status: typeof value.status === 'number' ? value.status : undefined,
    code: typeof value.code === 'string' ? value.code.slice(0, 100) : undefined,
    type: typeof value.type === 'string' ? value.type.slice(0, 100) : undefined,
  };
}
