import { Module } from '@nestjs/common';
import { VehicleRequestsController } from './vehicle-requests.controller';
import { VehicleRequestsService } from './vehicle-requests.service';
import { AuthModule } from '../auth/auth.module';
import { AllocationsModule } from '../allocations/allocations.module';

@Module({
  imports: [AuthModule, AllocationsModule],
  controllers: [VehicleRequestsController],
  providers: [VehicleRequestsService],
})
export class VehicleRequestsModule {}
