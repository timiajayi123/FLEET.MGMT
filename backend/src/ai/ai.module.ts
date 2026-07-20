import { Module } from '@nestjs/common';
import { AnalyticsModule } from '../analytics/analytics.module';
import { AuthModule } from '../auth/auth.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
@Module({ imports: [AuthModule, AnalyticsModule], controllers: [AiController], providers: [AiService] }) export class AiModule {}
