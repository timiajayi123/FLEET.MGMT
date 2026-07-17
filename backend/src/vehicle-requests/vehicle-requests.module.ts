import { Module } from '@nestjs/common';
import { VehicleRequestsController } from './vehicle-requests.controller';
import { VehicleRequestsService } from './vehicle-requests.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [VehicleRequestsController],
  providers: [VehicleRequestsService],
})
export class VehicleRequestsModule {}
