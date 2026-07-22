import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiRateLimitService } from './ai-rate-limit.service';
import { BuiltinFleetAssistantProvider } from './builtin-fleet-assistant.provider';
import { OpenAiFleetAssistantProvider } from './openai-fleet-assistant.provider';
@Module({ imports: [AuthModule, AnalyticsModule], controllers: [AiController], providers: [AiService, AiRateLimitService, BuiltinFleetAssistantProvider, OpenAiFleetAssistantProvider] }) export class AiModule {}
