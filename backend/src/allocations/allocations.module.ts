import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AllocationsController } from './allocations.controller';
import { AllocationsService } from './allocations.service';

@Module({ imports: [AuthModule], controllers: [AllocationsController], providers: [AllocationsService], exports: [AllocationsService] })
export class AllocationsModule {}
