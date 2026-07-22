import { Injectable } from '@nestjs/common';
import { BuiltinFleetAssistantProvider } from './builtin-fleet-assistant.provider';
import type { FleetAssistantContext, FleetAssistantResponse } from './fleet-assistant.provider';

@Injectable()
export class AiService {
  constructor(private readonly builtin: BuiltinFleetAssistantProvider) {}

  async ask(message: string, context: FleetAssistantContext): Promise<FleetAssistantResponse> {
    return this.builtin.ask(message, context);
  }
}
