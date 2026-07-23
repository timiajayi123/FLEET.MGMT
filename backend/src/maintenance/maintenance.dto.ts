import { IsDateString, IsIn, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

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
