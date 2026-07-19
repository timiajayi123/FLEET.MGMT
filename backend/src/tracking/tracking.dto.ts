import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TrackingPointDto {
  @IsOptional() @IsUUID() allocationId?: string;
  @IsOptional() @IsUUID() tripId?: string;
  @IsString() @MaxLength(100) clientEventId!: string;
  @IsNumber() @Min(-90) @Max(90) latitude!: number;
  @IsNumber() @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @IsNumber() @Min(0) accuracy?: number;
  @IsOptional() @IsNumber() @Min(0) speed?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(360) heading?: number;
  @IsOptional() @IsNumber() altitude?: number;
  @IsDateString() recordedAt!: string;
  @IsOptional() @IsBoolean() isSimulated?: boolean;
}

export class TrackingBatchDto {
  @IsArray() @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => TrackingPointDto)
  points!: TrackingPointDto[];
}

export class TripCoordinateDto {
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
}
