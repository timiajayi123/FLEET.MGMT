import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MasterDataModule } from './master-data/master-data.module';
import { PrismaModule } from './prisma/prisma.module';
import { VehicleRequestsModule } from './vehicle-requests/vehicle-requests.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { DriversModule } from './drivers/drivers.module';
import { AllocationsModule } from './allocations/allocations.module';
import { ImportsModule } from './imports/imports.module';
import { GpsModule } from './gps/gps.module';
import { GeocodingModule } from './geocoding/geocoding.module';
import { TrackingModule } from './tracking/tracking.module';
import { HealthModule } from './health/health.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MasterDataModule,
    VehicleRequestsModule,
    AuthModule,
    UsersModule,
    DashboardModule,
    VehiclesModule,
    DriversModule,
    AllocationsModule,
    ImportsModule,
    GpsModule,
    GeocodingModule,
    TrackingModule,
    HealthModule,
    AnalyticsModule,
    AiModule,
  ],
})
export class AppModule {}
