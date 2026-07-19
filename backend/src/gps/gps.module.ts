import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TrackingModule } from '../tracking/tracking.module';
import { GpsController } from './gps.controller';

@Module({ imports: [AuthModule, TrackingModule], controllers: [GpsController] })
export class GpsModule {}
