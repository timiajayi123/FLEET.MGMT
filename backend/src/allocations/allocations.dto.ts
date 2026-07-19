import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateAllocationDto {
  @IsOptional() @IsUUID() requestId?: string;
  @IsUUID() vehicleId!: string;
  @IsUUID() driverId!: string;
  @IsOptional() @IsString() @MaxLength(500) purpose?: string;
  @IsOptional() @IsString() @MaxLength(500) destination?: string;
  @IsDateString() startAt!: string;
  @IsDateString() expectedEndAt!: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ApproveRequestAllocationDto extends CreateAllocationDto {
  @IsOptional() @IsUUID() allocationId?: string;
}

export class RejectAllocationDto {
  @IsString() @MaxLength(1000) reason!: string;
}

export class ReportIssueDto {
  @IsString() @MaxLength(2000) message!: string;
}
