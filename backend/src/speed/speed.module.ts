import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SpeedController } from './speed.controller';
import { SpeedLimitsService } from './speed-limits.service';
import { SpeedService } from './speed.service';

@Module({ imports: [AuthModule], controllers: [SpeedController], providers: [SpeedLimitsService, SpeedService], exports: [SpeedLimitsService, SpeedService] })
export class SpeedModule {}
