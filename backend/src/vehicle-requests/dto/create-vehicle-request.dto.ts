import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RequestPriority } from '../../common/status.constants';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateVehicleRequestDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(2, 150)
  staffName!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  employeeId!: string;

  @ValidateIf((dto: CreateVehicleRequestDto) => !dto.customPickupLocation)
  @IsUUID()
  @IsOptional()
  locationId?: string;

  @ValidateIf((dto: CreateVehicleRequestDto) => !dto.locationId)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  customPickupLocation?: string;

  @IsUUID()
  directorateId!: string;

  @ValidateIf((dto: CreateVehicleRequestDto) => !dto.customDepartment)
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ValidateIf((dto: CreateVehicleRequestDto) => !dto.departmentId)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customDepartment?: string;

  @ValidateIf((dto: CreateVehicleRequestDto) => !dto.customUnit)
  @IsUUID()
  @IsOptional()
  unitId?: string;

  @ValidateIf((dto: CreateVehicleRequestDto) => !dto.unitId)
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customUnit?: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @IsIn(['Official', 'Non-Official'])
  purposeOfTrip!: string;

  @IsUUID()
  vehicleTypeId!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  destination!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  customDestination?: string;

  @IsDateString({ strict: true })
  departureDate!: string;

  @IsDateString({ strict: true })
  expectedReturnDate!: string;

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  numberOfPassengers!: number;

  @IsEnum(RequestPriority)
  priority!: RequestPriority;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  remarks!: string;
}
