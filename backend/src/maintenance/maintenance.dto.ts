import { IsDateString, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateMaintenanceRequestDto {
  @IsUUID() vehicleId!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) issueType!: string;
  @IsString() @IsNotEmpty() @MaxLength(2000) issueDescription!: string;
  @IsDateString() issueOccurredAt!: string;
}

export class ReviewMaintenanceRequestDto {
  @IsIn(['SERVICEABLE', 'UNSERVICEABLE']) serviceability!: 'SERVICEABLE' | 'UNSERVICEABLE';
  @IsString() @IsNotEmpty() @MaxLength(2000) adminRemark!: string;
}

export class MaintenanceDriverFeedbackDto {
  @IsIn(['SATISFACTORY', 'NOT_SATISFACTORY'])
  feedback!: 'SATISFACTORY' | 'NOT_SATISFACTORY';

  @IsOptional() @IsString() @MaxLength(1000) remark?: string;
}
