import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const decimal = ({ value }: { value: unknown }) =>
  value === '' || value === undefined || value === null ? undefined : Number(value);
const text = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const optionalId = ({ value }: { value: unknown }) =>
  value === '' || value === undefined || value === null ? undefined : value;

export class CreateFuelEntryDto {
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsUUID() driverId?: string;
  @IsOptional() @IsUUID() allocationId?: string;
  @IsOptional() @IsUUID() tripId?: string;
  @Transform(optionalId) @IsOptional() @IsUUID() stationId?: string;
  @IsOptional() @IsUUID() fuelCardId?: string;
  @IsDateString() fuelingAt!: string;
  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(200) stationName!: string;
  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(500) stationLocation!: string;
  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(40) fuelType!: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(40) entryType?: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(1000) reason?: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(2000) comments?: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(100) state?: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(100) city?: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(100) pumpNumber?: string;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) @Max(100) fuelLevelBefore?: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) @Max(100) fuelLevelAfter?: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0.001) requestedLitres?: number;
  @Transform(decimal) @IsNumber() @Min(0.001) @Max(10000) dispensedLitres!: number;
  @Transform(decimal) @IsNumber() @Min(0) @Max(10000000) pricePerLitre!: number;
  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(50) paymentMethod!: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(100) cardTransactionNumber?: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(100) receiptNumber?: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(100) vendorInvoice?: string;
  @Transform(decimal) @IsNumber() @Min(0) currentOdometer!: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) gpsDistance?: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) engineHours?: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @Transform(({ value }) => value === 'true' || value === true) @IsOptional() submit?: boolean;
}

export class DecisionDto {
  @IsIn(['APPROVE', 'REJECT']) decision!: 'APPROVE' | 'REJECT';
  @Transform(text) @IsOptional() @IsString() @MaxLength(2000) comment?: string;
}

export class FuelCardDto {
  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(100) cardNumber!: string;
  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(100) provider!: string;
  @IsDateString() issueDate!: string;
  @IsOptional() @IsDateString() expiryDate?: string;
  @IsOptional() @IsUUID() vehicleId?: string;
  @IsOptional() @IsUUID() driverId?: string;
  @IsOptional() @IsUUID() officeId?: string;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) monthlyLimit?: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) dailyLimit?: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) transactionLimit?: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) currentBalance?: number;
  @Transform(text) @IsOptional() @IsString() @MaxLength(1000) allowedFuelTypes?: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(1000) allowedStates?: string;
  @IsOptional() @IsUUID() allowedStationId?: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class StationDto {
  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(100) brand?: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(1000) address?: string;
  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(100) state!: string;
  @Transform(text) @IsOptional() @IsString() @MaxLength(100) city?: string;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @Transform(text) @IsOptional() @IsString() @MaxLength(100) contact?: string;
}

export class FuelPriceDto {
  @IsOptional() @IsUUID() stationId?: string;
  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(100) state!: string;
  @Transform(text) @IsString() @IsNotEmpty() @MaxLength(40) fuelType!: string;
  @IsDateString() effectiveDate!: string;
  @Transform(decimal) @IsNumber() @Min(0) pricePerLitre!: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) @Max(100) tolerancePct?: number;
}

export class BaselineDto {
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) expectedKmPerLitre?: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) manufacturerKmPerLitre?: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) tankCapacityLitres?: number;
  @Transform(decimal) @IsOptional() @IsNumber() @Min(0) @Max(100) acceptableTolerancePct?: number;
}
