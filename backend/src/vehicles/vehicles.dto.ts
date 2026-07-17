import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { VehicleStatus } from '../../generated/prisma/enums';

const empty = ({ value }: { value: unknown }) => (value === '' ? undefined : value);
const optionalNumber = ({ value }: { value: unknown }) =>
  value === '' || value === undefined || value === null ? undefined : Number(value);

export class SaveVehicleDto {
  @IsOptional() @IsString() registrationNumber?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() locationUser?: string;
  @IsOptional() @IsString() privateRegistrationNumber?: string;
  @IsOptional() @IsString() officialRegistrationNumber?: string;
  @IsString() manufacturer!: string;
  @IsString() model!: string;
  @Transform(optionalNumber) @IsOptional() @IsInt() @Min(1900) @Max(2100) year?: number;
  @IsOptional() @IsString() purchaseCost?: string;
  @IsOptional() @IsString() bookedValue?: string;
  @IsOptional() @IsString() estimatedCost?: string;
  @IsOptional() @IsString() reservedPresentValue?: string;
  @IsOptional() @IsString() age?: string;
  @IsOptional() @IsString() serviceability?: string;
  @IsOptional() @IsString() legacyAgency?: string;
  @IsOptional() @IsString() chassisNumber?: string;
  @IsOptional() @IsString() engineNumber?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsString() faultDescription?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsEnum(VehicleStatus) status?: VehicleStatus;
  @Transform(empty) @IsOptional() @IsUUID() locationId?: string;
  @Transform(empty) @IsOptional() @IsUUID() vehicleTypeId?: string;
}

export class BulkDeleteVehiclesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
  @IsUUID(undefined, { each: true })
  ids!: string[];
}
