import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
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

  @IsUUID()
  locationId!: string;

  @IsUUID()
  directorateId!: string;

  @IsUUID()
  departmentId!: string;

  @IsUUID()
  unitId!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @Length(5, 2000)
  purposeOfTrip!: string;

  @IsUUID()
  vehicleTypeId!: string;

  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  destination!: string;

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
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}
