import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiRateLimitService } from './ai-rate-limit.service';
import { BuiltinFleetAssistantProvider } from './builtin-fleet-assistant.provider';
@Module({ imports: [AuthModule, AnalyticsModule], controllers: [AiController], providers: [AiService, AiRateLimitService, BuiltinFleetAssistantProvider] }) export class AiModule {}
