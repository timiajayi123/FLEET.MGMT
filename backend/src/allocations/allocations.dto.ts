import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAllocationDto {
  @IsUUID() requestId!: string;
  @IsUUID() vehicleId!: string;
  @IsUUID() driverId!: string;
  @IsDateString() startAt!: string;
  @IsDateString() expectedEndAt!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class RejectAllocationDto {
  @IsString() @MaxLength(1000) reason!: string;
}

export class ReportIssueDto {
  @IsString() @MaxLength(2000) message!: string;
}
