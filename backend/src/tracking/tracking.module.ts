import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FleetGateway } from './fleet.gateway';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';
import { TripsService } from './trips.service';

@Module({ imports: [AuthModule], controllers: [TrackingController], providers: [FleetGateway, TrackingService, TripsService], exports: [TrackingService, TripsService] })
export class TrackingModule {}
